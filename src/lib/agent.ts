import { hrefFor } from '../router';

interface AgentTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

interface ModelContext {
  registerTool?: (tool: AgentTool) => void;
}

/** Registers local tools only when the browser offers a site-to-agent hook. Nothing is uploaded. */
export function registerLocalTools(): void {
  const host = navigator as Navigator & { modelContext?: ModelContext };
  const register = host.modelContext?.registerTool;
  if (!register) return;
  const tools: Array<{ name: string; route: string; description: string }> = [
    { name: 'compress_pdf', route: 'compress', description: 'Open Compress PDF on this device.' },
    { name: 'merge_pdf', route: 'merge', description: 'Open Merge PDF on this device.' },
    { name: 'split_pdf', route: 'split', description: 'Open Split PDF on this device.' },
    { name: 'apply_preset', route: 'presets', description: 'Open Get it accepted. Only verified presets are applied.' },
    { name: 'safe_to_share', route: 'share-check', description: 'Open the before-you-send check on this device.' },
  ];
  for (const tool of tools) {
    register({
      name: tool.name,
      description: `${tool.description} The file stays in this browser.`,
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' }, pages: { type: 'string' } },
        additionalProperties: false,
      },
      execute: (args) => {
        const params = new URLSearchParams();
        if (typeof args.target === 'string' && args.target) params.set('target', args.target);
        if (typeof args.pages === 'string' && args.pages) params.set('pages', args.pages);
        const query = params.toString();
        history.pushState(null, '', `${hrefFor(tool.route)}${query ? `?${query}` : ''}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
        return Promise.resolve('Opened on this device. The file was not uploaded.');
      },
    });
  }
}
