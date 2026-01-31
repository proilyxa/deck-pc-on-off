# PC On/Off - Wake on LAN Plugin for Steam Deck

A Decky Loader plugin that allows you to wake up and shut down your PC directly from your Steam Deck.

## Features

- 💚 Send Wake-on-LAN packets to wake up devices
- 🛑 Remote shutdown for devices (requires PC agent)
- 🟢 Real-time host status indicators (requires PC agent)
- 📝 Save multiple hosts with custom names
- 🔧 Simple IP-based configuration (MAC address detected automatically)
- 🎮 Clean, Steam Deck-optimized interface
- ✏️ Edit and delete saved hosts
- 🔄 Automatic MAC address refresh when device is online
- 🔌 Configurable port for shutdown agent (default: 9876)

## Requirements

- Steam Deck with Decky Loader installed
- Target device(s) must support Wake-on-LAN and have it enabled in BIOS/UEFI
- Network connectivity between Steam Deck and target device

## Installation

### Manual Installation

**Option 1: Install via Decky Loader (Recommended)**
1. Download the latest `.zip` file from the [releases page](https://github.com/proilyxa/deck-pc-on-off/releases)
2. Open Decky Loader on your Steam Deck (... button → Decky icon)
3. Go to Settings (gear icon) → Developer → "Install Plugin from ZIP"
4. Select the downloaded `.zip` file
5. The plugin will be installed and ready to use

**Option 2: Manual File Installation**
1. Download the latest release from the [releases page](https://github.com/proilyxa/deck-pc-on-off/releases)
2. Extract the contents to `~/homebrew/plugins/deck-pc-on-off/`
3. Restart Decky Loader or reload plugins

## Usage

1. Open the Quick Access menu on your Steam Deck (... button)
2. Navigate to the PC On/Off plugin
3. Click "Add Host" to add a new device
4. Enter the following information:
   - **Name**: A friendly name for your device (e.g., "Gaming PC")
   - **IP Address or Hostname**: The IP address or hostname of your device (e.g., `192.168.1.100` or `gaming-pc.local`)
   - **Port**: The port for the shutdown agent (default: 9876, only needed if using shutdown feature)
5. Click the power button (⏻) to send a WOL packet and wake up your device
6. Click the stop button (⏹) to send a shutdown command (requires PC agent to be running)

**Note:** The plugin automatically detects the MAC address from the IP using ARP. For this to work:
- The device must be online when you add it (or have been recently online)
- Both devices must be on the same network
- The MAC address is cached after the first successful detection

## Enabling Wake-on-LAN on Your PC

### In BIOS/UEFI
1. Enter BIOS/UEFI settings (usually by pressing Del, F2, or F12 during boot)
2. Look for "Wake on LAN", "WOL", or "Power On by PCI-E" settings
3. Enable the option
4. Save and exit

### In Windows
1. Open Device Manager
2. Find your network adapter
3. Right-click → Properties → Power Management
4. Enable "Allow this device to wake the computer"
5. Advanced tab → Enable "Wake on Magic Packet"
6. **Disable Fast Startup (Windows 10/11):**
   - Open Control Panel → Hardware and Sound → Power Options
   - Click "Choose what the power buttons do"
   - Click "Change settings that are currently unavailable"
   - **Uncheck** "Turn on fast startup (recommended)"
   - Click "Save changes"
   
   > **Why?** Fast Startup prevents Wake-on-LAN from working properly because it puts the PC into a hybrid shutdown state instead of a full shutdown.

### In Linux
```bash
sudo ethtool -s eth0 wol g
```
Replace `eth0` with your network interface name.

To make it persistent, add to `/etc/network/interfaces`:
```
post-up ethtool -s eth0 wol g
```

## PC Shutdown Agent (Optional)

To use the remote shutdown feature and real-time status indicators, you need to run an agent on your PC that listens for shutdown commands.

### Download Ready-to-Use Agent

A pre-built Windows agent is available here:  
**https://github.com/proilyxa/pc-agent**

The agent:
- Listens on port 9876 (configurable)
- Responds to `/ping` for status checks
- Responds to `/shutdown` to initiate PC shutdown
- Can be set up as a Windows service

**Status Indicator (requires agent):**
- 🟢 Green dot: PC agent is running and responding
- 🔴 Red dot: PC agent is not responding or offline

### Firewall Configuration

Make sure to allow incoming connections on the agent port (default: 9876):

**Windows Firewall:**
```powershell
New-NetFirewallRule -DisplayName "PC Shutdown Agent" -Direction Inbound -LocalPort 9876 -Protocol TCP -Action Allow
```

## Troubleshooting

**Cannot add host / "Could not find MAC address" error:**
- Make sure the device is currently online and reachable
- Verify you can ping the device from Steam Deck: `ping [ip-address]`
- Both devices must be on the same local network
- Check that the IP address is correct

**Device doesn't wake up:**
- Ensure Wake-on-LAN is enabled in BIOS and OS
- Make sure the device is connected via Ethernet (WiFi WOL is unreliable)
- Verify both devices are on the same network or VLAN
- Try waking the device again (the plugin refreshes MAC address on each wake attempt)
- Some routers/switches may block WOL packets - check router settings

**Shutdown doesn't work:**
- Verify the shutdown agent is running on your PC
- Check that the port is correct (default: 9876)
- Ensure the firewall allows incoming connections on the agent port
- Test the agent manually: `curl http://[pc-ip]:[port]/ping` (should return "OK")
- The agent must be running with administrator/root privileges

**Status indicator always shows red:**
- Status indicators require the PC agent to be installed and running
- Make sure the shutdown agent is running on your PC
- Verify the port number is correct in plugin settings
- Check firewall settings - the agent port must be accessible
- The status updates every 5 seconds while the plugin is open
- The agent must respond to `/ping` requests
- Without the agent, Wake-on-LAN will still work, but status will show red

**Plugin doesn't appear:**
- Restart Decky Loader
- Check the Decky logs for errors
- Ensure the plugin folder is in the correct location

## Acknowledgments

- Built using the [Decky Plugin Template](https://github.com/SteamDeckHomebrew/decky-plugin-template)
- Thanks to the [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) team
