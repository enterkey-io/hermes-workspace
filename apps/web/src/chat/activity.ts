export function toolActivity(name: string): string {
  switch (name) {
    case 'read_file':
    case 'read_files':
      return 'Reading files';
    case 'write_file':
    case 'patch':
    case 'apply_patch':
      return 'Updating files';
    case 'search_files':
    case 'search':
      return 'Searching files';
    case 'terminal':
    case 'exec_command':
      return 'Running a command';
    case 'web_search':
      return 'Searching the web';
    case 'web_extract':
    case 'web_fetch':
      return 'Reading a page';
    case 'browser':
    case 'browser_navigate':
      return 'Using the browser';
    case 'delegate_task':
    case 'message_agent':
      return 'Coordinating agents';
    case 'workspace_agents':
      return 'Managing pebbles';
    case 'pebble_react':
    case 'react_to_message':
      return 'Reacting';
    default: {
      const label = name.trim().replace(/[_-]+/g, ' ').slice(0, 80);
      return label ? `Using ${label}` : 'Using a tool';
    }
  }
}
