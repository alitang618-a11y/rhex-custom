"use client"

import { useMemo, useState, useTransition } from "react"
import { Trash2, Upload, Search } from "lucide-react"

import { showConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/rbutton"
import { TextField } from "@/components/ui/text-field"
import { formatDateTime } from "@/lib/formatters"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface AdminInviteCodeManagerProps {
  initialInviteCodes: {
    id: string
    code: string
    sourceSite: string | null
    expiresAt: string | null
    createdAt: string
    createdByUsername: string | null
    usedAt: string | null
    usedByUsername: string | null
    note: string | null
  }[]
}

type DeleteScope = "single" | "used" | "unused" | "all"

export function AdminInviteCodeManager({ initialInviteCodes }: AdminInviteCodeManagerProps) {
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes)
  const [count, setCount] = useState("10")
  const [note, setNote] = useState("")
  const [sourceSite, setSourceSite] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [searchSource, setSearchSource] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  // 导入弹窗状态
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")

  const summary = useMemo(() => ({
    total: inviteCodes.length,
    unused: inviteCodes.filter((item) => !item.usedAt).length,
    used: inviteCodes.filter((item) => item.usedAt).length,
    manual: inviteCodes.filter((item) => item.createdByUsername).length,
  }), [inviteCodes])

  // 重载列表（携带搜索参数）
  async function reloadInviteCodes() {
    const params = new URLSearchParams()
    if (searchSource) params.append("sourceSite", searchSource)
    const listResponse = await fetch(`/api/admin/invite-codes?${params.toString()}`, { cache: "no-store" })
    const listResult = await listResponse.json()
    setInviteCodes(Array.isArray(listResult.list) ? listResult.list : [])
  }

  // 生成邀请码（新增来源、过期时间）
  function handleGenerateInviteCodes() {
    setFeedback("")
    startTransition(async () => {
      const body: Record<string, any> = { count: Number(count), note }
      if (sourceSite) body.sourceSite = sourceSite
      if (expiresAt) body.expiresAt = expiresAt
      const response = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback(result.error ?? "生成失败")
        return
      }
      await reloadInviteCodes()
      setFeedback("生成成功")
      // 清空输入
      setSourceSite("")
      setExpiresAt("")
    })
  }

  // 批量导入邀请码
  async function handleImportCodes() {
    setFeedback("")
    const lines = importText.split("\n").map(s => s.trim()).filter(Boolean)
    if (lines.length === 0) return setFeedback("导入内容不能为空")
    const items = lines.map(line => {
      const parts = line.split("|")
      return {
        code: parts[0] ?? "",
        sourceSite: parts[1] ?? "",
        note: parts[2] ?? "",
        expiresAt: parts[3] ?? ""
      }
    })
    startTransition(async () => {
      const res = await fetch("/api/admin/invite-codes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback(data.error ?? "导入失败")
        return
      }
      setImportOpen(false)
      setImportText("")
      await reloadInviteCodes()
      setFeedback(`导入成功${data.importCount}条`)
    })
  }

  // 删除逻辑（兼容原有批量删除接口）
  async function handleDeleteInviteCodes(scope: DeleteScope, id?: string) {
    const affectedCount = scope === "single"
      ? 1
      : scope === "used"
        ? summary.used
        : scope === "unused"
          ? summary.unused
          : summary.total

    if (affectedCount === 0) {
      setFeedback("没有可删除的邀请码")
      return
    }

    const scopeLabel = scope === "single"
      ? "这个邀请码"
      : scope === "used"
        ? `${affectedCount} 个已使用邀请码`
        : scope === "unused"
          ? `${affectedCount} 个未使用邀请码`
          : `${affectedCount} 个邀请码`

    if (!await showConfirm({
      title: "删除邀请码",
      description: `确定删除${scopeLabel}？删除后不可恢复。`,
      confirmText: "删除",
      variant: "danger",
    })) {
      return
    }

    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/invite-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, id }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback(result.error ?? "删除失败")
        return
      }

      await reloadInviteCodes()
      setFeedback("删除成功")
    })
  }

  // 搜索回车/刷新
  const handleSearchSubmit = () => {
    reloadInviteCodes()
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="邀请码总数" value={summary.total} />
        <Stat title="未使用" value={summary.unused} />
        <Stat title="已使用" value={summary.used} />
        <Stat title="人工生成" value={summary.manual} />
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
        <TextField
          label="搜索来源站点"
          value={searchSource}
          onChange={setSearchSource}
          placeholder="输入来源站点筛选"
          inputClassName="h-10"
          className="flex-1"
        />
        <Button onClick={handleSearchSubmit} className="h-10 gap-1">
          <Search size={16} /> 搜索
        </Button>
        {/* 导入弹窗按钮 */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-10 gap-1">
              <Upload size={16} /> 批量导入
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>批量导入邀请码</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                格式：一行一条，竖线 | 分隔：邀请码|来源站点|备注|过期时间<br/>
                示例：ABCD123|周年活动|2026六周年|2027-12-31
              </p>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={10}
                placeholder="粘贴导入内容..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
                <Button onClick={handleImportCodes} disabled={isPending}>确认导入</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 生成面板（新增来源、过期时间输入框） */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">邀请码批量生成</h3>
        </div>
        <div className="grid gap-3 xl:grid-cols-[160px_220px_220px_minmax(0,1fr)_auto]">
          <TextField label="生成数量" value={count} onChange={setCount} placeholder="1-100" inputClassName="h-10" />
          <TextField label="来源站点" value={sourceSite} onChange={setSourceSite} placeholder="如 周年活动" inputClassName="h-10" />
          <TextField label="过期时间" value={expiresAt} onChange={setExpiresAt} placeholder="2027-12-31 留空永久有效" inputClassName="h-10" />
          <TextField label="备注" value={note} onChange={setNote} placeholder="活动赠送 / 人工发放" inputClassName="h-10" />
          <div className="flex items-end">
            <Button type="button" onClick={handleGenerateInviteCodes} disabled={isPending} className="h-10 rounded-full px-4 text-xs">
              {isPending ? "生成中..." : "生成邀请码"}
            </Button>
          </div>
        </div>
        {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}
      </div>

      {/* 批量删除按钮组 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Button type="button" variant="outline" onClick={() => void handleDeleteInviteCodes("used")} disabled={isPending || summary.used === 0}>删除已使用</Button>
        <Button type="button" variant="outline" onClick={() => void handleDeleteInviteCodes("unused")} disabled={isPending || summary.unused === 0}>删除未使用</Button>
        <Button type="button" variant="destructive" onClick={() => void handleDeleteInviteCodes("all")} disabled={isPending || summary.total === 0}>删除全部</Button>
        <span className="text-xs text-muted-foreground">删除操作不可恢复。</span>
      </div>

      {/* 表格表头新增 来源站点、过期时间 */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1fr)_140px_140px_160px_180px_minmax(0,1fr)_72px]">
          <span>邀请码</span>
          <span>来源站点</span>
          <span>过期时间</span>
          <span>创建人</span>
          <span>使用状态</span>
          <span>备注</span>
          <span>操作</span>
        </div>
        {inviteCodes.length === 0 ? <div className="px-4 py-10 text-sm text-muted-foreground">当前还没有邀请码。</div> : null}
        {inviteCodes.map((item) => (
          <div key={item.id} className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1fr)_140px_140px_160px_180px_minmax(0,1fr)_72px]">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-medium">{item.code}</div>
              <div className="mt-1 text-muted-foreground">{formatDateTime(item.createdAt)}</div>
            </div>
            <div className="truncate text-muted-foreground">{item.sourceSite ?? "-"}</div>
            <div className="truncate text-muted-foreground">
              {item.expiresAt ? formatDateTime(item.expiresAt) : "永久有效"}
            </div>
            <div className="truncate text-muted-foreground">{item.createdByUsername ?? "系统"}</div>
            <div className="text-muted-foreground">
              {item.usedAt ? `已被 ${item.usedByUsername ?? ""} 使用` : "未使用"}
            </div>
            <div className="truncate text-muted-foreground">{item.note ?? "-"}</div>
            <div>
              <Button type="button" variant="destructive" size="icon-sm" title="删除邀请码" aria-label={`删除邀请码 ${item.code}`} onClick={() => void handleDeleteInviteCodes("single", item.id)} disabled={isPending}>
                <Trash2 data-icon="inline-start" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
