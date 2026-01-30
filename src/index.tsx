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
import React, { useState, useEffect } from "react";
import { FaPowerOff, FaPlus, FaTrash, FaEdit } from "react-icons/fa";

interface Host {
  id: number;
  name: string;
  ip: string;
  mac?: string;
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

// Backend API calls
const getHosts = callable<[], Host[]>("get_hosts");
const addHost = callable<[name: string, ip: string], HostResult>("add_host");
const updateHost = callable<[id: number, name: string, ip: string], HostResult>("update_host");
const deleteHost = callable<[id: number], { success: boolean; error?: string }>("delete_host");
const wakeHost = callable<[id: number], WakeResult>("wake_host");

interface AddHostModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AddHostModal: React.FC<AddHostModalProps> = ({ onSuccess, onClose }) => {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim() !== "" && ip.trim() !== "";

  const handleSave = async () => {
    if (!isValid) return;
    
    setSaving(true);
    setError("");

    try {
      const result = await addHost(name.trim(), ip.trim());
      if (result.success) {
        toaster.toast({
          title: "Success",
          body: "Host added"
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
      strTitle="Add Host"
      bAllowFullSize={true}
      strOKButtonText={saving ? "Saving..." : "Save"}
      strCancelButtonText="Cancel"
      bOKDisabled={!isValid || saving}
      onOK={handleSave}
      onCancel={onClose}
    >
      <div style={{ padding: "10px" }}>
        <div style={{ marginBottom: "10px" }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <TextField
            label="IP Address or Hostname"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            disabled={saving}
          />
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

interface EditHostModalProps {
  host: Host;
  onSuccess: () => void;
  onClose: () => void;
}

const EditHostModal: React.FC<EditHostModalProps> = ({ host, onSuccess, onClose }) => {
  const [name, setName] = useState(host.name);
  const [ip, setIp] = useState(host.ip);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim() !== "" && ip.trim() !== "";

  const handleUpdate = async () => {
    if (!isValid) return;
    
    setSaving(true);
    setError("");

    try {
      const result = await updateHost(host.id, name.trim(), ip.trim());
      if (result.success) {
        toaster.toast({
          title: "Success",
          body: "Host updated"
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
      strTitle="Edit Host"
      bAllowFullSize={true}
      strOKButtonText={saving ? "Saving..." : "Save"}
      strCancelButtonText="Cancel"
      bOKDisabled={!isValid || saving}
      onOK={handleUpdate}
      onCancel={onClose}
    >
      <div style={{ padding: "10px" }}>
        <div style={{ marginBottom: "10px" }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <TextField
            label="IP Address or Hostname"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            disabled={saving}
          />
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

  const loadHosts = async () => {
    try {
      const result = await getHosts();
      setHosts(result);
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: "Failed to load hosts"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHosts();
  }, []);

  const handleWake = async (hostId: number, hostName: string) => {
    if (wakingHostId !== null) return; // Prevent spam
    
    setWakingHostId(hostId);
    
    try {
      const result = await wakeHost(hostId);
      if (result.success) {
        toaster.toast({
          title: "Sent",
          body: `WOL packet sent to ${hostName}`
        });
      } else {
        toaster.toast({
          title: "Error",
          body: result.error || "Failed to send WOL packet"
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: String(error)
      });
    } finally {
      // Unlock after 2 seconds
      setTimeout(() => {
        setWakingHostId(null);
      }, 2000);
    }
  };

  const handleDelete = (host: Host) => {
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
  };

  const handleAdd = () => {
    const modal = showModal(
      <AddHostModal
        onSuccess={loadHosts}
        onClose={() => modal.Close()}
      />
    );
  };

  const handleEdit = (host: Host) => {
    const modal = showModal(
      <EditHostModal
        host={host}
        onSuccess={loadHosts}
        onClose={() => modal.Close()}
      />
    );
  };

  if (loading) {
    return (
      <PanelSection title="Wake on LAN">
        <PanelSectionRow>
          <div>Loading...</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Wake on LAN">
      {hosts.length === 0 ? (
        <PanelSectionRow>
          <div style={{ padding: "10px", textAlign: "center", opacity: 0.7 }}>
            No saved hosts
          </div>
        </PanelSectionRow>
      ) : (
        hosts.map((host) => {
          const isWaking = wakingHostId === host.id;
          const displayName = host.name.length > 20 
            ? host.name.substring(0, 20) + "..." 
            : host.name;
          
          return (
            <PanelSectionRow key={host.id}>
              <Focusable style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", padding: "5px 0" }}>
                <Focusable 
                  flow-children="horizontal"
                  style={{ 
                    display: "flex", 
                    gap: "8px", 
                    alignItems: "center",
                    justifyContent: "flex-start"
                  }}
                >
                  <DialogButton
                    onClick={() => handleWake(host.id, host.name)}
                    disabled={wakingHostId !== null}
                    style={{ 
                      minWidth: "40px",
                      width: "40px",
                      padding: "10px", 
                      height: "40px",
                      opacity: isWaking ? 0.5 : 1,
                      backgroundColor: isWaking ? "#4ade80" : undefined,
                      transition: "opacity 0.2s, background-color 0.2s"
                    }}
                  >
                    <FaPowerOff />
                  </DialogButton>
                  
                  <DialogButton
                    onClick={() => handleEdit(host)}
                    disabled={wakingHostId !== null}
                    style={{ minWidth: "40px", width: "40px", padding: "10px", height: "40px" }}
                  >
                    <FaEdit />
                  </DialogButton>
                  
                  <DialogButton
                    onClick={() => handleDelete(host)}
                    disabled={wakingHostId !== null}
                    style={{ minWidth: "40px", width: "40px", padding: "10px", height: "40px" }}
                  >
                    <FaTrash />
                  </DialogButton>
                </Focusable>
                
                <div style={{ 
                  fontSize: "1em", 
                  fontWeight: "500",
                  paddingLeft: "8px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                  {displayName}
                </div>
                
                <div style={{ 
                  fontSize: "0.85em", 
                  opacity: 0.6,
                  paddingLeft: "8px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                  {host.ip}
                </div>
              </Focusable>
            </PanelSectionRow>
          );
        })
      )}
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
    </PanelSection>
  );
};

export default definePlugin(() => {
  console.log("PC On/Off plugin initializing")

  return {
    // The name shown in various decky menus
    name: "PC On/Off",
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>Wake on LAN</div>,
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
