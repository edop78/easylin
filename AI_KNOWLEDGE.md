# EasyLin AI Module - Technical Knowledge Base

## 1. Network Architecture
- **Mode**: `network_mode: host` (defined in `docker-compose.yml`).
- **Communication**: The backend container shares the host network stack.
- **Ollama API**: Primary endpoint is `http://127.0.0.1:11434/api`.
- **Fallback Endpoints**: `localhost`, `host.docker.internal` (if bridged), and `ollama` (if containerized).

## 2. Database Schema (easylin.db)
### Table: `chat_messages`
| Column | Type | Description |
| --- | --- | --- |
| id | INTEGER | Primary Key (Auto-increment) |
| model | TEXT | Model name (e.g., qwen2.5:3b) |
| role | TEXT | assistant or user |
| content | TEXT | Message body |
| created_at | TIMESTAMP | Default CURRENT_TIMESTAMP |

### Table: `ai_permissions`
| Column | Type | Description |
| --- | --- | --- |
| capability | TEXT | Primary Key (e.g., shell_exec, docker_mgmt) |
| enabled | INTEGER | 0 (Disabled) or 1 (Enabled) |
| level | TEXT | low, medium, or high |
| description | TEXT | Human-readable description |
| updated_at | TIMESTAMP | Last modification time |

## 3. Critical Capabilities
| Capability | Level | Purpose |
| --- | --- | --- |
| `system_info` | low | Basic metrics and OS info |
| `docker_mgmt` | medium | Container lifecycle |
| `file_read` | medium | System inspection |
| `file_write` | high | Host mutation |
| `shell_exec` | high | Arbitrary execution |

## 4. Operational Protocols
1. **Always verify** Ollama connectivity via `check_ollama()` before critical operations.
2. **Use streaming** (SSE) for both Chat and Model Pull to prevent gateway timeouts (504).
3. **Tool calls** should be preceded by a status update to the frontend (e.g., "Executing tool...").
4. **Never hallucinate** container IDs; always run `list_containers` first.
