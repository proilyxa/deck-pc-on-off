import os
import json
import socket
import subprocess
import re

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
import asyncio

class Plugin:
    def __init__(self):
        self.settings_file = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "hosts.json")
        self.hosts = []

    def _load_hosts(self):
        """Load hosts from settings file"""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r') as f:
                    self.hosts = json.load(f)
            else:
                self.hosts = []
        except Exception as e:
            decky.logger.error(f"Error loading hosts: {e}")
            self.hosts = []

    def _save_hosts(self):
        """Save hosts to settings file"""
        try:
            os.makedirs(os.path.dirname(self.settings_file), exist_ok=True)
            with open(self.settings_file, 'w') as f:
                json.dump(self.hosts, f, indent=2)
        except Exception as e:
            decky.logger.error(f"Error saving hosts: {e}")

    def _is_valid_mac(self, mac: str) -> bool:
        """Check if MAC address is valid and not a placeholder"""
        if not mac:
            return False
        
        # Normalize MAC address
        mac_clean = mac.replace(':', '').replace('-', '').replace('.', '').upper()
        
        # Check if it's all zeros (incomplete/not found)
        if mac_clean == '000000000000':
            return False
        
        # Check if it's all F's (broadcast)
        if mac_clean == 'FFFFFFFFFFFF':
            return False
        
        # Check if it matches pattern like 00:00:00:00:00:00
        if re.match(r'^(00[:-]?){6}$', mac.lower()):
            return False
        
        return True

    def _get_mac_from_ip(self, ip_address: str) -> str:
        """Get MAC address from IP using ARP"""
        try:
            # First, try to ping the host to populate ARP cache
            ping_paths = ["/usr/bin/ping", "/bin/ping", "ping"]
            for ping_path in ping_paths:
                try:
                    ping_cmd = [ping_path, "-c", "1", "-W", "1", ip_address]
                    subprocess.run(ping_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3)
                    break
                except FileNotFoundError:
                    continue
            
            # Try multiple methods to get MAC address
            
            # Method 1: Try ip neigh (most common on modern Linux)
            ip_paths = ["/usr/bin/ip", "/bin/ip", "/sbin/ip", "ip"]
            for ip_path in ip_paths:
                try:
                    neigh_cmd = [ip_path, "neigh", "show", ip_address]
                    result = subprocess.run(neigh_cmd, capture_output=True, text=True, timeout=3)
                    if result.returncode == 0:
                        mac_match = re.search(r'([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})', result.stdout)
                        if mac_match:
                            mac = mac_match.group(0)
                            if self._is_valid_mac(mac):
                                decky.logger.info(f"Found MAC {mac} for IP {ip_address} via ip neigh")
                                return mac
                            else:
                                decky.logger.warning(f"Invalid MAC {mac} for IP {ip_address}")
                except FileNotFoundError:
                    continue
            
            # Method 2: Try arp command
            arp_paths = ["/usr/sbin/arp", "/usr/bin/arp", "/sbin/arp", "arp"]
            for arp_path in arp_paths:
                try:
                    arp_cmd = [arp_path, "-n", ip_address]
                    result = subprocess.run(arp_cmd, capture_output=True, text=True, timeout=3)
                    if result.returncode == 0:
                        # Parse ARP output to find MAC address
                        for line in result.stdout.split('\n'):
                            if ip_address in line:
                                mac_match = re.search(r'([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})', line)
                                if mac_match:
                                    mac = mac_match.group(0)
                                    if self._is_valid_mac(mac):
                                        decky.logger.info(f"Found MAC {mac} for IP {ip_address} via arp")
                                        return mac
                                    else:
                                        decky.logger.warning(f"Invalid MAC {mac} for IP {ip_address}")
                except FileNotFoundError:
                    continue
            
            # Method 3: Try reading /proc/net/arp directly
            try:
                with open('/proc/net/arp', 'r') as f:
                    for line in f:
                        if ip_address in line:
                            parts = line.split()
                            if len(parts) >= 4:
                                mac = parts[3]
                                if re.match(r'([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})', mac):
                                    if self._is_valid_mac(mac):
                                        decky.logger.info(f"Found MAC {mac} for IP {ip_address} via /proc/net/arp")
                                        return mac
                                    else:
                                        decky.logger.warning(f"Invalid MAC {mac} for IP {ip_address}")
            except Exception as e:
                decky.logger.warning(f"Could not read /proc/net/arp: {e}")
            
            raise ValueError(f"Could not find MAC address for {ip_address}. Make sure the host is reachable and on the same network.")
            
        except subprocess.TimeoutExpired:
            raise ValueError(f"Timeout while trying to reach {ip_address}")
        except Exception as e:
            decky.logger.error(f"Error getting MAC from IP: {e}")
            raise ValueError(f"Failed to get MAC address: {str(e)}")

    def _parse_mac_address(self, mac_str: str) -> bytes:
        """Parse MAC address string to bytes"""
        # Remove common separators
        mac_str = mac_str.replace(':', '').replace('-', '').replace('.', '')
        if len(mac_str) != 12:
            raise ValueError("Invalid MAC address format")
        return bytes.fromhex(mac_str)

    def _create_magic_packet(self, mac_address: str) -> bytes:
        """Create Wake-on-LAN magic packet"""
        mac_bytes = self._parse_mac_address(mac_address)
        # Magic packet: 6 bytes of 0xFF followed by 16 repetitions of the MAC address
        return b'\xff' * 6 + mac_bytes * 16

    async def get_hosts(self) -> list:
        """Get all saved hosts"""
        self._load_hosts()
        return self.hosts

    async def add_host(self, name: str, ip_address: str) -> dict:
        """Add a new host"""
        try:
            if not name or not ip_address:
                return {"success": False, "error": "Name and IP address are required"}
            
            # Get MAC address from IP
            mac_address = self._get_mac_from_ip(ip_address)
            
            # Generate new ID (starting from 1, avoiding duplicates)
            max_id = max([h["id"] for h in self.hosts], default=0)
            new_id = max_id + 1
            
            host = {
                "id": new_id,
                "name": name,
                "ip": ip_address,
                "mac": mac_address
            }
            self.hosts.append(host)
            self._save_hosts()
            decky.logger.info(f"Added host: {name} ({ip_address} -> {mac_address})")
            return {"success": True, "host": host}
        except Exception as e:
            decky.logger.error(f"Error adding host: {e}")
            return {"success": False, "error": str(e)}

    async def update_host(self, host_id: int, name: str, ip_address: str) -> dict:
        """Update an existing host"""
        try:
            self._load_hosts()
            
            if not name or not ip_address:
                return {"success": False, "error": "Name and IP address are required"}
            
            # Find existing host
            old_host = None
            for host in self.hosts:
                if host["id"] == host_id:
                    old_host = host
                    break
            
            if not old_host:
                return {"success": False, "error": "Host not found"}
            
            # Only get new MAC if IP changed
            if old_host["ip"] != ip_address:
                decky.logger.info(f"IP changed from {old_host['ip']} to {ip_address}, getting new MAC")
                mac_address = self._get_mac_from_ip(ip_address)
            else:
                decky.logger.info(f"IP unchanged, keeping existing MAC {old_host.get('mac', 'N/A')}")
                mac_address = old_host.get("mac", "")
            
            # Update host
            for i, host in enumerate(self.hosts):
                if host["id"] == host_id:
                    self.hosts[i] = {
                        "id": host_id,
                        "name": name,
                        "ip": ip_address,
                        "mac": mac_address
                    }
                    self._save_hosts()
                    decky.logger.info(f"Updated host: {name}")
                    return {"success": True, "host": self.hosts[i]}
            
            return {"success": False, "error": "Host not found"}
        except Exception as e:
            decky.logger.error(f"Error updating host: {e}")
            return {"success": False, "error": str(e)}

    async def delete_host(self, host_id: int) -> dict:
        """Delete a host"""
        try:
            self._load_hosts()
            self.hosts = [h for h in self.hosts if h["id"] != host_id]
            self._save_hosts()
            decky.logger.info(f"Deleted host with id: {host_id}")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error deleting host: {e}")
            return {"success": False, "error": str(e)}

    async def wake_host(self, host_id: int) -> dict:
        """Send Wake-on-LAN packet to host"""
        try:
            self._load_hosts()
            host = next((h for h in self.hosts if h["id"] == host_id), None)
            
            if not host:
                return {"success": False, "error": "Host not found"}
            
            # Get current MAC address (in case IP changed)
            try:
                mac_address = self._get_mac_from_ip(host["ip"])
                # Update stored MAC if different
                if mac_address != host.get("mac"):
                    for i, h in enumerate(self.hosts):
                        if h["id"] == host_id:
                            self.hosts[i]["mac"] = mac_address
                            self._save_hosts()
                            break
            except Exception as e:
                # Use stored MAC if we can't get current one
                decky.logger.warning(f"Could not refresh MAC, using stored value: {e}")
                mac_address = host.get("mac")
                if not mac_address:
                    return {"success": False, "error": "No MAC address available"}
            
            # Create magic packet
            magic_packet = self._create_magic_packet(mac_address)
            
            # Send packet to broadcast
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(magic_packet, ("255.255.255.255", 9))
            
            # Also try to send directly to the IP
            try:
                sock.sendto(magic_packet, (host["ip"], 9))
            except:
                pass
            
            sock.close()
            
            decky.logger.info(f"Sent WOL packet to {host['name']} ({host['ip']} -> {mac_address})")
            return {"success": True, "message": f"Wake-on-LAN packet sent to {host['name']}"}
            
        except Exception as e:
            decky.logger.error(f"Error sending WOL packet: {e}")
            return {"success": False, "error": str(e)}

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        self._load_hosts()
        decky.logger.info("PC On/Off Plugin loaded!")

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        decky.logger.info("PC On/Off Plugin unloading...")
        pass

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("PC On/Off Plugin uninstalling...")
        pass

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        decky.logger.info("Migrating PC On/Off Plugin...")
        pass
