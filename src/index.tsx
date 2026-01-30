import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  ConfirmModal,
  showModal,
  staticClasses
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
} from "@decky/api"
import { useState, useEffect, FC } from "react";
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

interface HostFormProps {
  host?: Host;
  onSave: () => void;
  onCancel: () => void;
}

const HostForm: FC<HostFormProps> = ({ host, onSave, onCancel }) => {
  const [name, setName] = useState(host?.name || "");
  const [ip, setIp] = useState(host?.ip || "");

  const handleSave = async () => {
    if (!name || !ip) {
      toaster.toast({
        title: "Error",
        body: "Name and IP address are required"
      });
      return;
    }

    try {
      const result = host
        ? await updateHost(host.id, name, ip)
        : await addHost(name, ip);

      if (result.success) {
        toaster.toast({
          title: "Success",
          body: host ? "Host updated" : "Host added"
        });
        onSave();
      } else {
        toaster.toast({
          title: "Error",
          body: result.error || "Unknown error"
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: String(error)
      });
    }
  };

  return (
    <div style={{ padding: "10px" }}>
      <div style={{ marginBottom: "10px" }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <TextField
          label="IP Address or Hostname"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <ButtonItem
          layout="below"
          onClick={handleSave}
        >
          Save
        </ButtonItem>
        <ButtonItem
          layout="below"
          onClick={onCancel}
        >
          Cancel
        </ButtonItem>
      </div>
    </div>
  );
};

function Content() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);

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
    showModal(
      <ConfirmModal
        strTitle="Add Host"
        bAllowFullSize={true}
        onOK={() => {}}
        onCancel={() => {}}
      >
        <HostForm
          onSave={() => {
            loadHosts();
          }}
          onCancel={() => {}}
        />
      </ConfirmModal>
    );
  };

  const handleEdit = (host: Host) => {
    showModal(
      <ConfirmModal
        strTitle="Edit Host"
        bAllowFullSize={true}
        onOK={() => {}}
        onCancel={() => {}}
      >
        <HostForm
          host={host}
          onSave={() => {
            loadHosts();
          }}
          onCancel={() => {}}
        />
      </ConfirmModal>
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
        hosts.map((host) => (
          <PanelSectionRow key={host.id}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <ButtonItem
                    layout="below"
                    onClick={() => handleWake(host.id, host.name)}
                  >
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px", 
                      justifyContent: "center",
                      backgroundColor: "#4ade80",
                      color: "#000",
                      fontWeight: "bold",
                      padding: "8px",
                      borderRadius: "4px"
                    }}>
                      <FaPowerOff />
                      <span>{host.name}</span>
                    </div>
                  </ButtonItem>
                </div>
                <div style={{ display: "flex", gap: "5px" }}>
                  <ButtonItem
                    layout="below"
                    onClick={() => handleEdit(host)}
                  >
                    <FaEdit />
                  </ButtonItem>
                  <ButtonItem
                    layout="below"
                    onClick={() => handleDelete(host)}
                  >
                    <FaTrash />
                  </ButtonItem>
                </div>
              </div>
              <div style={{ fontSize: "0.85em", opacity: 0.7 }}>
                IP: {host.ip}
              </div>
            </div>
          </PanelSectionRow>
        ))
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
