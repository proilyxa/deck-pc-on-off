import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  ConfirmModal,
  showModal,
  staticClasses,
  Focusable,
  DialogButton
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
} from "@decky/api"
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaPowerOff, FaPlus, FaTrash, FaEdit, FaStop } from "react-icons/fa";

interface Host {
  id: number;
  name: string;
  ip: string;
  mac?: string;
  port: number;
}

interface WakeResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface HostResult {
  success: boolean;
  host?: Host;
  error?: string;
}

interface PingResult {
  success: boolean;
  online: boolean;
  error?: string;
}

// Backend API calls
const getHosts = callable<[], Host[]>("get_hosts");
const addHost = callable<[name: string, ip: string, port: number], HostResult>("add_host");
const updateHost = callable<[id: number, name: string, ip: string, port: number], HostResult>("update_host");
const deleteHost = callable<[id: number], { success: boolean; error?: string }>("delete_host");
const wakeHost = callable<[id: number], WakeResult>("wake_host");
const pingHost = callable<[id: number], PingResult>("ping_host");
const shutdownHost = callable<[id: number], WakeResult>("shutdown_host");

// Parse error message to show user-friendly short message
const getErrorMessage = (error: string | undefined): string => {
  if (!error) return "Request failed";
  const errorLower = error.toLowerCase();
  if (errorLower.includes("connection refused")) return "Agent not running";
  if (errorLower.includes("timed out") || errorLower.includes("timeout")) return "Host not responding";
  if (errorLower.includes("host not found")) return "Host not found";
  if (errorLower.includes("no mac address")) return "No MAC address";
  if (errorLower.includes("network is unreachable")) return "Network unreachable";
  return "Request failed";
};

// Unified modal for add/edit
interface HostFormModalProps {
  host?: Host; // undefined = add mode, defined = edit mode
  onSuccess: () => void;
  onClose: () => void;
}

const HostFormModal: React.FC<HostFormModalProps> = ({ host, onSuccess, onClose }) => {
  const [name, setName] = useState(host?.name || "");
  const [ip, setIp] = useState(host?.ip || "");
  const [port, setPort] = useState(String(host?.port || 9876));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim() && ip.trim() && port.trim();
  const isEditMode = !!host;

  const handleSave = async () => {
    if (!isValid) return;
    
    setSaving(true);
    setError("");

    try {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        setError("Port must be a number between 1 and 65535");
        setSaving(false);
        return;
      }

      const result = isEditMode
        ? await updateHost(host.id, name.trim(), ip.trim(), portNum)
        : await addHost(name.trim(), ip.trim(), portNum);

      if (result.success) {
        toaster.toast({
          title: "Success",
          body: isEditMode ? "Host updated" : "Host added"
        });
        onSuccess();
        onClose();
      } else {
        setError("Check the entered IP and make sure the PC is online");
      }
    } catch (err) {
      setError("Check the entered IP and make sure the PC is online");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmModal
      strTitle={isEditMode ? "Edit Host" : "Add Host"}
      bAllowFullSize={true}
      strOKButtonText={saving ? "Saving..." : "Save"}
      strCancelButtonText="Cancel"
      bOKDisabled={!isValid || saving}
      onOK={handleSave}
      onCancel={onClose}
    >
      <div style={{ padding: "10px" }}>
        <div style={{ marginBottom: "10px" }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <TextField label="IP Address or Hostname" value={ip} onChange={(e) => setIp(e.target.value)} disabled={saving} />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <TextField label="Port (default: 9876)" value={port} onChange={(e) => setPort(e.target.value)} disabled={saving} />
        </div>
        {error && (
          <div style={{ 
            color: "#ff6b6b", 
            fontSize: "0.9em", 
            marginTop: "10px",
            padding: "8px",
            backgroundColor: "rgba(255, 107, 107, 0.1)",
            borderRadius: "4px"
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </ConfirmModal>
  );
};


function Content() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [wakingHostId, setWakingHostId] = useState<number | null>(null);
  const [shuttingDownHostId, setShuttingDownHostId] = useState<number | null>(null);
  const [hostStatuses, setHostStatuses] = useState<Record<number, boolean>>({});

  const hostsRef = useRef<Host[]>([]);
  
  // Update ref when hosts change
  useEffect(() => {
    hostsRef.current = hosts;
  }, [hosts]);

  const pingAllHosts = useCallback(async (hostsToPing: Host[]) => {
    if (hostsToPing.length === 0) return;

    const results = await Promise.all(
      hostsToPing.map(async (host) => {
        try {
          const result = await pingHost(host.id);
          return { id: host.id, online: result.online };
        } catch {
          return { id: host.id, online: false };
        }
      })
    );

    setHostStatuses(prev => ({
      ...prev,
      ...Object.fromEntries(results.map(({ id, online }) => [id, online]))
    }));
  }, []);

  const loadHosts = useCallback(async () => {
    try {
      const result = await getHosts();
      setHosts(result);
      
      // Initialize status for new hosts only
      setHostStatuses(prev => {
        const updated = { ...prev };
        result.forEach(host => {
          if (!(host.id in updated)) updated[host.id] = false;
        });
        return updated;
      });
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: "Failed to load hosts"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHosts();
  }, [loadHosts]);

  // Ping hosts periodically while plugin is open
  useEffect(() => {
    if (hosts.length === 0) return;

    // Immediate first ping
    pingAllHosts(hostsRef.current);

    // Set up interval for periodic pinging using ref to avoid recreating interval
    const intervalId = setInterval(() => {
      pingAllHosts(hostsRef.current);
    }, 5000); // Ping every 5 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosts.length]); // Only recreate if host count changes

  const executeHostCommand = useCallback(async (
    hostId: number,
    hostName: string,
    action: 'wake' | 'shutdown'
  ) => {
    if (wakingHostId !== null || shuttingDownHostId !== null) return;
    
    const setActiveId = action === 'wake' ? setWakingHostId : setShuttingDownHostId;
    const apiCall = action === 'wake' ? wakeHost : shutdownHost;
    const successMsg = action === 'wake' ? `WOL packet sent to ${hostName}` : `Shutdown command sent to ${hostName}`;
    
    setActiveId(hostId);
    
    try {
      const result = await apiCall(hostId);
      toaster.toast({
        title: result.success ? "Sent" : "Error",
        body: result.success ? successMsg : getErrorMessage(result.error)
      });
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: getErrorMessage(String(error))
      });
    } finally {
      setTimeout(() => setActiveId(null), 2000);
    }
  }, [wakingHostId, shuttingDownHostId]);

  const handleWake = useCallback((hostId: number, hostName: string) => 
    executeHostCommand(hostId, hostName, 'wake'), [executeHostCommand]);

  const handleShutdown = useCallback((hostId: number, hostName: string) => 
    executeHostCommand(hostId, hostName, 'shutdown'), [executeHostCommand]);

  const handleDelete = useCallback((host: Host) => {
    showModal(
      <ConfirmModal
        strTitle="Delete Host?"
        strDescription={`Are you sure you want to delete "${host.name}"?`}
        strOKButtonText="Delete"
        strCancelButtonText="Cancel"
        onOK={async () => {
          try {
            const result = await deleteHost(host.id);
            if (result.success) {
              toaster.toast({
                title: "Success",
                body: "Host deleted"
              });
              loadHosts();
            } else {
              toaster.toast({
                title: "Error",
                body: result.error || "Failed to delete host"
              });
            }
          } catch (error) {
            toaster.toast({
              title: "Error",
              body: String(error)
            });
          }
        }}
      />
    );
  }, [loadHosts]);

  const handleAdd = useCallback(() => {
    const modal = showModal(
      <HostFormModal onSuccess={loadHosts} onClose={() => modal.Close()} />
    );
  }, [loadHosts]);

  const handleEdit = useCallback((host: Host) => {
    const modal = showModal(
      <HostFormModal host={host} onSuccess={loadHosts} onClose={() => modal.Close()} />
    );
  }, [loadHosts]);

  if (loading) {
    return (
      <PanelSection>
        <PanelSectionRow>
          <div>Loading...</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleAdd}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
            <FaPlus />
            <span>Add Host</span>
          </div>
        </ButtonItem>
      </PanelSectionRow>
      
      {hosts.length === 0 ? (
        <PanelSectionRow>
          <div style={{ padding: "10px", textAlign: "center", opacity: 0.7 }}>
            No saved hosts
          </div>
        </PanelSectionRow>
      ) : (
        hosts.map((host) => {
          const isWaking = wakingHostId === host.id;
          const isShuttingDown = shuttingDownHostId === host.id;
          const isOnline = hostStatuses[host.id];
          const hasStatus = host.id in hostStatuses;
          const isDisabled = wakingHostId !== null || shuttingDownHostId !== null;
          const displayName = host.name.length > 20 ? host.name.substring(0, 20) + ".." : host.name;
          
          const buttonStyle = { minWidth: "40px", width: "40px", padding: "10px", height: "40px" };
          
          return (
            <PanelSectionRow key={host.id}>
              <Focusable style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", padding: "5px 0" }}>
                <Focusable flow-children="horizontal" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <DialogButton
                    onClick={() => handleWake(host.id, host.name)}
                    disabled={isDisabled}
                    style={{ 
                      ...buttonStyle,
                      opacity: isWaking ? 0.5 : 1,
                      backgroundColor: isWaking ? "#4ade80" : undefined,
                      transition: "opacity 0.2s, background-color 0.2s"
                    }}
                  >
                    <FaPowerOff />
                  </DialogButton>
                  
                  <DialogButton
                    onClick={() => handleShutdown(host.id, host.name)}
                    disabled={isDisabled}
                    style={{ 
                      ...buttonStyle,
                      opacity: isShuttingDown ? 0.5 : 1,
                      backgroundColor: isShuttingDown ? "#ef4444" : undefined,
                      transition: "opacity 0.2s, background-color 0.2s"
                    }}
                  >
                    <FaStop />
                  </DialogButton>
                  
                  <DialogButton onClick={() => handleEdit(host)} disabled={isDisabled} style={buttonStyle}>
                    <FaEdit />
                  </DialogButton>
                  
                  <DialogButton onClick={() => handleDelete(host)} disabled={isDisabled} style={buttonStyle}>
                    <FaTrash />
                  </DialogButton>
                </Focusable>
                
                <div style={{ fontSize: "0.95em", paddingLeft: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {hasStatus && (
                    <div style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: isOnline ? "#4ade80" : "#ef4444",
                      flexShrink: 0
                    }} />
                  )}
                  <span style={{ fontWeight: "500" }}>{displayName}</span>
                  <span style={{ opacity: 0.6, flexShrink: 0 }}>({host.ip})</span>
                </div>
              </Focusable>
            </PanelSectionRow>
          );
        })
      )}
    </PanelSection>
  );
};

export default definePlugin(() => {
  console.log("PC On/Off plugin initializing")

  return {
    // The name shown in various decky menus
    name: "PC On/Off",
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>PC On/Off</div>,
    // The content of your plugin's menu
    content: <Content />,
    // The icon displayed in the plugin list
    icon: <FaPowerOff />,
    // The function triggered when your plugin unloads
    onDismount() {
      console.log("PC On/Off plugin unloading")
    },
  };
});
