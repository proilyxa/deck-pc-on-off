# PC On/Off - Wake on LAN Plugin for Steam Deck

A Decky Loader plugin that allows you to wake up your PC or other devices using Wake-on-LAN (WOL) magic packets directly from your Steam Deck.

## Features

- 💚 Send Wake-on-LAN packets to wake up devices
- 📝 Save multiple hosts with custom names
- 🔧 Simple IP-based configuration (MAC address detected automatically)
- 🎮 Clean, Steam Deck-optimized interface
- ✏️ Edit and delete saved hosts
- 🔄 Automatic MAC address refresh when device is online

## Requirements

- Steam Deck with Decky Loader installed
- Target device(s) must support Wake-on-LAN and have it enabled in BIOS/UEFI
- Network connectivity between Steam Deck and target device

## Installation

### From Decky Store (Coming Soon)
Once approved, you'll be able to install this plugin directly from the Decky Plugin Store.

### Manual Installation
1. Download the latest release from the [releases page](https://github.com/proilyxa/deck-pc-on-off/releases)
2. Extract the `pc-on-off` folder to `~/homebrew/plugins/`
3. Restart Decky Loader or reload plugins

### Development Installation
```bash
# Clone the repository
git clone https://github.com/proilyxa/deck-pc-on-off.git
cd deck-pc-on-off

# Install dependencies
pnpm install

# Build the plugin
pnpm build

# Create a symlink to the plugins directory
mkdir -p ~/homebrew/plugins
ln -s $(pwd) ~/homebrew/plugins/pc-on-off
```

## Usage

1. Open the Quick Access menu on your Steam Deck (... button)
2. Navigate to the PC On/Off plugin
3. Click "Add Host" to add a new device
4. Enter the following information:
   - **Name**: A friendly name for your device (e.g., "Gaming PC")
   - **IP Address or Hostname**: The IP address or hostname of your device (e.g., `192.168.1.100` or `gaming-pc.local`)
5. Click the green power button to send a WOL packet and wake up your device

**Note:** The plugin automatically detects the MAC address from the IP using ARP. For this to work:
- The device must be online when you add it (or have been recently online)
- Both devices must be on the same network
- The MAC address is cached after the first successful detection

## How to Find Your PC's IP Address

### Windows
```cmd
ipconfig
```
Look for "IPv4 Address" under your network adapter.

### Linux
```bash
ip addr show
```
or
```bash
hostname -I
```

### macOS
```bash
ifconfig
```
Look for "inet" under your network interface.

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

### In Linux
```bash
sudo ethtool -s eth0 wol g
```
Replace `eth0` with your network interface name.

To make it persistent, add to `/etc/network/interfaces`:
```
post-up ethtool -s eth0 wol g
```

## Building

```bash
# Install dependencies
pnpm install

# Build once
pnpm build

# Build and watch for changes
pnpm watch
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

**Plugin doesn't appear:**
- Restart Decky Loader
- Check the Decky logs for errors
- Ensure the plugin folder is in the correct location

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built using the [Decky Plugin Template](https://github.com/SteamDeckHomebrew/decky-plugin-template)
- Thanks to the [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) team
