import { useState } from 'react';
import { Search, Copy, Check, Layers, HardDrive, Cpu, ShieldAlert, Wifi, FileText, BookOpen } from 'lucide-react';

const COMMANDS_DATA = [
  // --- DOCKER ---
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
  {
    cmd: "docker run -d -p <host_port>:<container_port> --name <container_name> <image_name>",
    name: "Run container in background",
    desc: "Creates and starts a new container from an image, mapping a host port to a container port and running it in detached mode.",
    category: "Docker",
    icon: Layers,
    example: "docker run -d -p 8080:80 --name web_server nginx"
  },
  {
    cmd: "docker stop <container_id>",
    name: "Stop a running container",
    desc: "Gracefully stops a running container by sending SIGTERM followed by SIGKILL if it doesn't terminate within the grace period.",
    category: "Docker",
    icon: Layers,
    example: "docker stop web_server"
  },
  {
    cmd: "docker start <container_id>",
    name: "Start a stopped container",
    desc: "Starts one or more stopped containers preserving their original creation parameters.",
    category: "Docker",
    icon: Layers,
    example: "docker start web_server"
  },
  {
    cmd: "docker restart <container_id>",
    name: "Restart a container",
    desc: "Restarts a container, stopping it first and then booting it back up. Excellent for applying fast configuration restarts.",
    category: "Docker",
    icon: Layers,
    example: "docker restart web_server"
  },
  {
    cmd: "docker rm -f <container_id>",
    name: "Force remove a container",
    desc: "Stops and permanently deletes a container from the local engine database.",
    category: "Docker",
    icon: Layers,
    example: "docker rm -f web_server"
  },
  {
    cmd: "docker images",
    name: "List local images",
    desc: "Lists all local Docker images that have been pulled or built, along with their tags, IDs, sizes, and creation times.",
    category: "Docker",
    icon: Layers,
    example: "docker images"
  },
  {
    cmd: "docker rmi <image_id>",
    name: "Remove a local image",
    desc: "Deletes a local Docker image from the engine storage (fails if any containers are currently using it).",
    category: "Docker",
    icon: Layers,
    example: "docker rmi nginx:latest"
  },
  {
    cmd: "docker volume ls",
    name: "List Docker volumes",
    desc: "Displays all persistent local storage volumes created and managed by the Docker daemon.",
    category: "Docker",
    icon: Layers,
    example: "docker volume ls"
  },
  {
    cmd: "docker network ls",
    name: "List Docker networks",
    desc: "Lists all virtual networks created by the Docker daemon (bridge, host, overlay, macvlan, etc.).",
    category: "Docker",
    icon: Layers,
    example: "docker network ls"
  },
  {
    cmd: "docker-compose up -d",
    name: "Compose up (detached)",
    desc: "Reads the local docker-compose.yml file, builds/pulls the required images, and starts all declared services in the background.",
    category: "Docker",
    icon: Layers,
    example: "docker-compose up -d"
  },
  {
    cmd: "docker-compose down",
    name: "Compose down & cleanup",
    desc: "Stops and deletes all containers, networks, and volumes declared in the docker-compose setup.",
    category: "Docker",
    icon: Layers,
    example: "docker-compose down"
  },
  {
    cmd: "docker-compose logs -f",
    name: "Follow Compose service logs",
    desc: "Tails and streams combined terminal logs of all services running inside the current docker-compose stack.",
    category: "Docker",
    icon: Layers,
    example: "docker-compose logs -f --tail 50"
  },
  {
    cmd: "docker cp <host_path> <container_id>:<container_path>",
    name: "Copy files in/out of container",
    desc: "Copies files or directories from the local host system into a container namespace, or vice versa.",
    category: "Docker",
    icon: Layers,
    example: "docker cp ./config.json web_server:/etc/nginx/config.json"
  },

  // --- SYSTEM ---
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
    icon: FileText,
    example: "journalctl -u ssh -n 100 -f"
  },
  {
    cmd: "systemctl status <service>",
    name: "Get system service status",
    desc: "Displays the active/inactive/failed running status, process IDs, and latest logs of a systemd service.",
    category: "System",
    icon: Cpu,
    example: "systemctl status docker"
  },
  {
    cmd: "systemctl restart <service>",
    name: "Restart system service",
    desc: "Stops and immediately restarts a service managed by systemd on the host system.",
    category: "System",
    icon: Cpu,
    example: "systemctl restart nginx"
  },
  {
    cmd: "systemctl enable <service>",
    name: "Enable service on boot",
    desc: "Configures a systemd service to start automatically during system bootup.",
    category: "System",
    icon: Cpu,
    example: "systemctl enable fail2ban"
  },
  {
    cmd: "uname -a",
    name: "Show system kernel info",
    desc: "Prints all system information including kernel name, network node hostname, release version, and processor architecture.",
    category: "System",
    icon: Cpu,
    example: "uname -a"
  },
  {
    cmd: "uptime",
    name: "Check system uptime",
    desc: "Shows how long the server has been running, the number of users logged in, and system load averages for 1, 5, and 15 minutes.",
    category: "System",
    icon: Cpu,
    example: "uptime"
  },
  {
    cmd: "lscpu",
    name: "Display CPU details",
    desc: "Collects and lists detailed CPU architecture information including core counts, sockets, model, and cache sizes.",
    category: "System",
    icon: Cpu,
    example: "lscpu"
  },
  {
    cmd: "lsblk",
    name: "List block storage devices",
    desc: "Lists all available storage devices (hard disks, SSDs, partitions) in a tree-like hierarchy showing sizes and mountpoints.",
    category: "System",
    icon: HardDrive,
    example: "lsblk"
  },
  {
    cmd: "dmesg -T | tail -n 50",
    name: "Kernel diagnostic logs",
    desc: "Displays the last 50 entries of the kernel ring buffer with readable human timestamps for diagnosing hardware/driver issues.",
    category: "System",
    icon: FileText,
    example: "dmesg -T | tail -n 50"
  },

  // --- NETWORK ---
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
    cmd: "ufw allow <port>/tcp",
    name: "Open port in firewall",
    desc: "Adds a rule to UFW allowing incoming TCP traffic on the specified port from any external location.",
    category: "Network",
    icon: ShieldAlert,
    example: "ufw allow 2222/tcp"
  },
  {
    cmd: "curl -I <url>",
    name: "Fetch HTTP headers",
    desc: "Sends a request to a URL and prints only the HTTP response headers (useful for checking server status).",
    category: "Network",
    icon: Wifi,
    example: "curl -I https://google.com"
  },
  {
    cmd: "ping -c 4 <host>",
    name: "Ping network destination",
    desc: "Sends 4 ICMP ECHO_REQUEST packets to query the availability and latency of a target host or IP.",
    category: "Network",
    icon: Wifi,
    example: "ping -c 4 8.8.8.8"
  },
  {
    cmd: "traceroute <host>",
    name: "Trace packet route",
    desc: "Tracks and lists all intermediate router hops and packet transition times toward a network destination.",
    category: "Network",
    icon: Wifi,
    example: "traceroute google.com"
  },
  {
    cmd: "dig <domain_name>",
    name: "Query DNS details",
    desc: "Queries DNS name servers for domain records (A, MX, TXT, NS) to troubleshoot resolution issues.",
    category: "Network",
    icon: Wifi,
    example: "dig google.com"
  },
  {
    cmd: "wget -O <output_file> <download_url>",
    name: "Download file from web",
    desc: "Downloads a file from a remote HTTP/HTTPS/FTP URL and saves it locally under the specified filename.",
    category: "Network",
    icon: Wifi,
    example: "wget -O speedtest.zip http://example.com/test.zip"
  },

  // --- FILES ---
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
  },
  {
    cmd: "ls -lah",
    name: "List files (detailed)",
    desc: "Lists all files in the current folder, including hidden files (.dotfiles), in long format with sizes, owners, and permissions.",
    category: "Files",
    icon: BookOpen,
    example: "ls -lah"
  },
  {
    cmd: "grep -rnw '/path' -e 'search_string'",
    name: "Search text recursively",
    desc: "Searches recursively for a specific string inside all text files within a folder, showing filenames and line numbers.",
    category: "Files",
    icon: BookOpen,
    example: "grep -rnw '/etc' -e 'Port'"
  },
  {
    cmd: "tail -n 50 -f <file_path>",
    name: "Tail log file",
    desc: "Prints the last 50 lines of a text file and keeps monitoring it to print new lines as they are written.",
    category: "Files",
    icon: FileText,
    example: "tail -n 50 -f /var/log/nginx/error.log"
  },
  {
    cmd: "tar -czvf <archive_name>.tar.gz /source/directory",
    name: "Compress folder (Gzip)",
    desc: "Creates a compressed gzip tar archive from a source folder, preserving ownerships and file permissions.",
    category: "Files",
    icon: BookOpen,
    example: "tar -czvf backup_site.tar.gz /var/www/html"
  },
  {
    cmd: "tar -xzvf <archive_name>.tar.gz",
    name: "Decompress Gzip archive",
    desc: "Extracts all files and directories from a compressed .tar.gz archive into the current directory.",
    category: "Files",
    icon: BookOpen,
    example: "tar -xzvf backup_site.tar.gz"
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
            placeholder="Search commands, descriptions or syntax..."
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
                      color: item.category === 'Docker' ? 'var(--accent-blue)' : 
                             item.category === 'Network' ? 'var(--accent-purple)' :
                             item.category === 'System' ? 'var(--accent-green)' : 'var(--accent-yellow)',
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
