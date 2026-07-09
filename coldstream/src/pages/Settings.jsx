import { useStore, update, resetDemo } from '../lib/store.js'
import { PageHeader, Card, Button, Input, fmtNum } from '../components/ui.jsx'

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const waitlist = useStore((s) => s.waitlist || [])

  const patch = (p) => update((s) => ({ ...s, settings: { ...s.settings, ...p } }))

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="max-w-lg">
        <label className="mb-1 block text-xs text-slate-500">Workspace name</label>
        <Input value={settings.workspaceName} onChange={(e) => patch({ workspaceName: e.target.value })} />
        <label className="mb-1 mt-4 block text-xs text-slate-500">Sender name (used by the AI writer sign-offs)</label>
        <Input value={settings.senderName} onChange={(e) => patch({ senderName: e.target.value })} />
      </Card>

      <Card className="mt-4 max-w-lg">
        <h3 className="font-medium text-white">Landing page waitlist</h3>
        <p className="mt-1 text-sm text-slate-400">
          {waitlist.length === 0
            ? 'No signups captured yet — they appear here when someone joins from the landing page.'
            : `${fmtNum(waitlist.length)} signup${waitlist.length > 1 ? 's' : ''}:`}
        </p>
        {waitlist.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {waitlist.map((e) => <li key={e}>· {e}</li>)}
          </ul>
        )}
      </Card>

      <Card className="mt-4 max-w-lg border-red-900/50">
        <h3 className="font-medium text-white">Demo data</h3>
        <p className="mt-1 text-sm text-slate-400">Reset the workspace to the original seeded demo state. Your campaigns, imported leads, and connected accounts will be replaced.</p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={() => { if (confirm('Reset workspace to demo state?')) resetDemo() }}
        >
          Reset demo workspace
        </Button>
      </Card>
    </div>
  )
}
