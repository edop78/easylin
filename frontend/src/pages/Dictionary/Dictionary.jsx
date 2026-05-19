import { useState } from 'react';
import { Search, Copy, Check, Terminal, BookOpen, Layers, HardDrive, Cpu, ShieldAlert, Wifi } from 'lucide-react';

const COMMANDS_DATA = [
  // Docker & Containers
  {
    cmd: "docker ps -a",
    name: "List all containers",
    desc: "Lists all local Docker containers, showing their running state, ID, names, and exposed ports.",
    category: "Docker",
    icon: Layers,
    example: "docker ps -a"
  },
  {
    cmd: "docker logs -f --tail 100 <container_id>",
    name: "Follow container logs",
    desc: "Streams the live logs of a container in real-time, showing only the last 100 lines at start.",
    category: "Docker",
    icon: Layers,
    example: "docker logs -f --tail 100 my_web_app"
  },
  {
    cmd: "docker exec -it <container_id> /bin/bash",
    name: "Shell inside a container",
    desc: "Starts an interactive bash terminal inside a running container for direct file system access and debugging.",
    category: "Docker",
    icon: Layers,
    example: "docker exec -it my_database_1 /bin/bash"
  },
  {
    cmd: "docker system prune -a --volumes",
    name: "Deep clean Docker resources",
    desc: "Removes all unused Docker containers, networks, images (both dangling and unused), and volumes to reclaim disk space.",
    category: "Docker",
    icon: Layers,
    example: "docker system prune -a --volumes"
  },
  {
    cmd: "docker stats",
    name: "Live container resource usage",
    desc: "Displays a live streaming statistics feed of CPU, memory, network, and disk I/O usage for all running containers.",
    category: "Docker",
    icon: Layers,
    example: "docker stats"
  },
  // System & Monitoring
  {
    cmd: "df -h",
    name: "Disk space usage",
    desc: "Displays the amount of disk space available on all mounted filesystems in human-readable format (MB/GB).",
    category: "System",
    icon: HardDrive,
    example: "df -h"
  },
  {
    cmd: "free -h",
    name: "RAM memory usage",
    desc: "Displays total, used, and free system memory (RAM and Swap) in human-readable format.",
    category: "System",
    icon: Cpu,
    example: "free -h"
  },
  {
    cmd: "du -sh *",
    name: "Directory size summary",
    desc: "Estimates and displays the disk space usage of all files and folders in the current directory.",
    category: "System",
    icon: HardDrive,
    example: "du -sh /var/log/*"
  },
  {
    cmd: "htop",
    name: "Interactive process monitor",
    desc: "Launches an interactive, colorful command-line system monitor and process manager (requires htop).",
    category: "System",
    icon: Cpu,
    example: "htop"
  },
  {
    cmd: "journalctl -u <service> -n 100 -f",
    name: "Stream systemd service logs",
    desc: "Streams the live system log output of a specific systemd service (e.g. docker, ssh, nginx).",
    category: "System",
    icon: BookOpen,
    example: "journalctl -u ssh -n 100 -f"
  },
  // Network & Firewall
  {
    cmd: "ss -tlnp",
    name: "Show active TCP listeners",
    desc: "Lists all active, listening TCP socket ports alongside the process name and PID that opened them.",
    category: "Network",
    icon: Wifi,
    example: "ss -tlnp"
  },
  {
    cmd: "ip a",
    name: "Show network interfaces",
    desc: "Displays all active network interfaces, their link statuses, MAC addresses, and assigned IP addresses (IPv4/IPv6).",
    category: "Network",
    icon: Wifi,
    example: "ip a"
  },
  {
    cmd: "ufw status numbered",
    name: "Check firewall status & rules",
    desc: "Displays the active/inactive state of the UFW firewall along with all configured rules with reference indexes.",
    category: "Network",
    icon: ShieldAlert,
    example: "ufw status numbered"
  },
  {
    cmd: "curl -I <url>",
    name: "Fetch HTTP headers",
    desc: "Sends a request to a URL and prints only the HTTP response headers (useful for checking server status).",
    category: "Network",
    icon: Wifi,
    example: "curl -I https://google.com"
  },
  // Files & Access
  {
    cmd: "chmod -R 755 /path/to/folder",
    name: "Modify folder permissions recursively",
    desc: "Grants read, write, and execute permissions to owner, and read/execute permissions to group/others recursively.",
    category: "Files",
    icon: BookOpen,
    example: "chmod -R 755 /var/www/html"
  },
  {
    cmd: "chown -R user:group /path/to/folder",
    name: "Modify folder owner recursively",
    desc: "Changes the owner user and primary group of a file or folder and all its contents recursively.",
    category: "Files",
    icon: BookOpen,
    example: "chown -R www-data:www-data /var/www/html"
  },
  {
    cmd: "find . -name \"*.log\" -size +10M",
    name: "Find large log files",
    desc: "Searches the current directory and subdirectories for files ending in .log that are larger than 10 Megabytes.",
    category: "Files",
    icon: BookOpen,
    example: "find /var/log -name \"*.log\" -size +50M"
  }
];

export default function Dictionary() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const categories = ['All', 'System', 'Docker', 'Network', 'Files'];

  const handleCopy = (cmd, index) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const filteredCommands = COMMANDS_DATA.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.cmd.toLowerCase().includes(search.toLowerCase()) || 
                          item.name.toLowerCase().includes(search.toLowerCase()) ||
                          item.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <BookOpen size={28} />
          <h1>Command Dictionary</h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              color: 'var(--text-muted)' 
            }} 
          />
          <input
            type="text"
            placeholder="Search commands, description or syntax..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-blue)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-xs)', 
        marginBottom: 'var(--space-lg)',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)'
      }}>
        {filteredCommands.map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div key={idx} className="card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 'var(--space-md)',
              minHeight: '220px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      background: 'var(--bg-card-hover)', 
                      color: item.category === 'Docker' ? 'var(--accent-blue)' : 'var(--accent-green)',
                      padding: '6px',
                      borderRadius: '8px',
                      display: 'flex'
                    }}>
                      <IconComponent size={16} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{item.name}</span>
                  </div>
                  <span className="badge" style={{
                    background: item.category === 'Docker' ? 'var(--accent-blue-dim)' : 'var(--bg-card-hover)',
                    color: item.category === 'Docker' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    border: 'none',
                    fontSize: '11px'
                  }}>
                    {item.category}
                  </span>
                </div>

                <p style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '0.85rem', 
                  lineHeight: '1.4', 
                  marginBottom: 'var(--space-md)',
                  height: '42px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {item.desc}
                </p>
              </div>

              <div>
                <div style={{ 
                  background: 'var(--bg-primary)', 
                  borderRadius: '6px', 
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-color)',
                  marginBottom: '8px'
                }}>
                  <code className="mono" style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-primary)',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    marginRight: '8px',
                    flex: 1
                  }}>
                    {item.cmd}
                  </code>
                  <button 
                    onClick={() => handleCopy(item.cmd, idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedIndex === idx ? 'var(--accent-green)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      padding: '4px',
                      borderRadius: '4px',
                      transition: 'all 0.15s'
                    }}
                    title="Copy command"
                  >
                    {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600 }}>Example:</span>
                  <span className="mono">{item.example}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCommands.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', padding: 'var(--space-xl)', textAlign: 'center' }}>
            <BookOpen size={40} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No commands match your query or category selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}
