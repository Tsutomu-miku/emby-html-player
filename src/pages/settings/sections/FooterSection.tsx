export function FooterSection({
  onReset,
  onSync,
  syncing,
  toast,
}: {
  onReset: () => void
  onSync: () => Promise<void>
  syncing: boolean
  toast: string
}) {
  return (
    <>
      <section className="card p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between border-l-4 border-l-jelly-accent">
        <div className="space-y-1">
          <div className="font-semibold">操作</div>
          <div className="text-sm text-jelly-muted leading-relaxed">
            ⚠️「同步到 Emby 服务器」会<strong>写入该账号的用户配置</strong>
            （字幕语言、自动跳下一集、片头跳过模式、续播回退秒数等），仅在你希望<strong>多端共享</strong>这些设置时使用。
            <br />
            默认情况下所有设置仅存储在本机应用存储（
            <code className="mx-1 px-1 py-0.5 bg-white/5 rounded font-mono text-xs">ehp_settings</code>
            ）。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={onReset}>
            恢复默认设置
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void onSync()}
            disabled={syncing}
          >
            {syncing ? '同步中…' : '🔗 同步到 Emby 服务器（当前用户）'}
          </button>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-md bg-jelly-card border border-white/10 text-jelly-text shadow-2xl text-sm animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </>
  )
}
