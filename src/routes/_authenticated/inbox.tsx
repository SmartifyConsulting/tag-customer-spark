import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Inbox as InboxIcon,
  Loader2,
  MessageSquare,
  Search,
  Send,
  StickyNote,
  Tag as TagIcon,
  UserPlus,
  Sparkles,
  Megaphone,
} from "lucide-react";
import { BroadcastComposerDialog } from "@/components/notifications/broadcast-composer-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listConversations,
  getConversation,
  sendReply,
  updateConversation,
  listAssignableStaff,
} from "@/lib/inbox.functions";
import { summariseConversation } from "@/lib/ai.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "WhatsApps — Tag" }] }),
  component: InboxPage,
});

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function fmtTime(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function InboxPage() {
  const [scope, setScope] = useState<"all" | "unread" | "mine" | "unassigned" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const qc = useQueryClient();

  const listFn = useServerFn(listConversations);
  const { data: list, isLoading } = useQuery({
    queryKey: ["conversations", scope, search],
    queryFn: () => listFn({ data: { scope, search: search || undefined } }),
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!activeId && list && list.length > 0) setActiveId(list[0].id);
  }, [list, activeId]);

  // Realtime invalidation
  useEffect(() => {
    const ch = supabase
      .channel("inbox-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
        if (activeId) qc.invalidateQueries({ queryKey: ["conversation", activeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, activeId]);

  return (
    <div className="space-y-4">
      <PageHeader title="WhatsApps" description="Every WhatsApp response, in one place." />

      <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr_320px] gap-0 overflow-hidden rounded-2xl border border-border bg-card">
        {/* List */}
        <div className="border-r border-border flex flex-col min-h-0">
          <div className="p-3 space-y-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, subject"
                className="pl-8 h-9"
              />
            </div>
            <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
              <TabsList className="w-full grid grid-cols-5 h-8">
                <TabsTrigger value="all" className="text-[11px] px-1">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-[11px] px-1">Unread</TabsTrigger>
                <TabsTrigger value="mine" className="text-[11px] px-1">Mine</TabsTrigger>
                <TabsTrigger value="unassigned" className="text-[11px] px-1">Open</TabsTrigger>
                <TabsTrigger value="resolved" className="text-[11px] px-1">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : !list || list.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={InboxIcon} title="No conversations" description="Customer responses will appear here." />
              </div>
            ) : (
              list.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left p-3 border-b border-border/60 hover:bg-accent/50 transition-colors",
                    activeId === c.id && "bg-accent",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials(c.customer?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate text-sm">
                          {c.customer?.full_name ?? c.customer?.whatsapp_e164 ?? "Customer"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {fmtTime(c.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {c.subject ?? "New conversation"}
                        </span>
                        {c.unread_count > 0 && (
                          <Badge className="h-4 min-w-4 px-1 text-[10px] bg-muted text-muted-foreground">{c.unread_count}</Badge>
                        )}
                      </div>
                      {c.tags?.length > 0 && (
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {c.tags.slice(0, 3).map((t: string) => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        {activeId ? (
          <ConversationPane id={activeId} />
        ) : (
          <div className="flex items-center justify-center p-10 text-center">
            <EmptyState icon={MessageSquare} title="Select a conversation" description="Pick a thread from the left to view messages." />
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationPane({ id }: { id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getConversation);
  const replyFn = useServerFn(sendReply);
  const updateFn = useServerFn(updateConversation);
  const staffFn = useServerFn(listAssignableStaff);

  const { data, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: staff } = useQuery({ queryKey: ["staff-assignable"], queryFn: () => staffFn() });

  const [text, setText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newTag, setNewTag] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.conversation?.unread_count) {
      updateFn({ data: { id, mark_read: true } }).then(() =>
        qc.invalidateQueries({ queryKey: ["conversations"] }),
      );
    }
  }, [data?.conversation?.unread_count, id, updateFn, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const messages = useMemo(() => data?.messages ?? [], [data]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await replyFn({ data: { conversation_id: id, body: text.trim(), is_internal: isInternal } });
      setText("");
      await qc.invalidateQueries({ queryKey: ["conversation", id] });
    } finally {
      setSending(false);
    }
  }

  async function assign(userId: string | null) {
    await updateFn({ data: { id, assigned_to: userId } });
    qc.invalidateQueries({ queryKey: ["conversation", id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function toggleResolved() {
    await updateFn({ data: { id, is_resolved: !data?.conversation?.is_resolved } });
    qc.invalidateQueries({ queryKey: ["conversation", id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function addTag() {
    if (!newTag.trim()) return;
    const next = Array.from(new Set([...(data?.conversation?.tags ?? []), newTag.trim()]));
    setNewTag("");
    await updateFn({ data: { id, tags: next } });
    qc.invalidateQueries({ queryKey: ["conversation", id] });
  }
  async function removeTag(t: string) {
    const next = (data?.conversation?.tags ?? []).filter((x: string) => x !== t);
    await updateFn({ data: { id, tags: next } });
    qc.invalidateQueries({ queryKey: ["conversation", id] });
  }

  if (isLoading || !data) return <div className="p-6"><Skeleton className="h-full w-full" /></div>;

  const c = data.conversation;
  const customer = c.customer;
  const assignedStaff = staff?.find((s: any) => s.user_id === c.assigned_to);

  return (
    <>
      <div className="flex flex-col min-h-0 border-r border-border">
        {/* header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(customer?.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{customer?.full_name ?? customer?.whatsapp_e164}</div>
            <div className="text-xs text-muted-foreground truncate">{customer?.whatsapp_e164}</div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-1" />
                  {assignedStaff?.full_name ?? "Assign"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => assign(null)}>Unassigned</DropdownMenuItem>
                <DropdownMenuSeparator />
                {staff?.map((s: any) => (
                  <DropdownMenuItem key={s.user_id} onSelect={() => assign(s.user_id)}>
                    {s.full_name ?? s.role}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <SummariseButton conversationId={c.id} onSuggestion={(s) => setText((t) => t || s)} />
            <Button
              variant={c.is_resolved ? "secondary" : "default"}
              size="sm"
              onClick={toggleResolved}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {c.is_resolved ? "Reopen" : "Resolve"}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No messages yet.</div>
          ) : (
            messages.map((m: any) => (
              <MessageBubble key={m.id} message={m} />
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsInternal(false)}
              className={cn(
                "px-2 h-7 rounded-md border",
                !isInternal ? "bg-primary text-primary-foreground border-primary" : "border-border",
              )}
            >
              <MessageSquare className="h-3 w-3 inline mr-1" />Reply
            </button>
            <button
              type="button"
              onClick={() => setIsInternal(true)}
              className={cn(
                "px-2 h-7 rounded-md border",
                isInternal ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/40" : "border-border",
              )}
            >
              <StickyNote className="h-3 w-3 inline mr-1" />Internal note
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={isInternal ? "Add a private note for your team…" : "Type your reply…"}
              rows={2}
              className="resize-none"
            />
            <Button onClick={send} disabled={!text.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</p>
        </div>
      </div>

      {/* Customer panel */}
      <aside className="hidden lg:flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Customer</h3>
          <div className="rounded-xl border border-border p-3 space-y-1.5 text-sm">
            <div className="font-medium">{customer?.full_name ?? "—"}</div>
            <div className="text-muted-foreground text-xs">{customer?.whatsapp_e164}</div>
            <div className="text-muted-foreground text-xs">Opted in: {fmtTime(customer?.opted_in_at)}</div>
            <div className="flex gap-1 flex-wrap pt-1">
              {customer?.marketing_consent_at && <Badge variant="secondary" className="text-[10px]">Marketing</Badge>}
              {customer?.notify_consent_at && <Badge variant="secondary" className="text-[10px]">Notifications</Badge>}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><TagIcon className="h-3 w-3" />Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {(c.tags ?? []).map((t: string) => (
              <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => removeTag(t)}>
                {t} ×
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="add tag…" className="h-8 text-xs" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTag(); } }} />
            <Button size="sm" variant="outline" onClick={addTag}>Add</Button>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Interests</h3>
          <div className="space-y-2">
            {data.interests.length === 0 && <p className="text-xs text-muted-foreground">No tracked products yet.</p>}
            {data.interests.map((i: any) => (
              <div key={i.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                {i.product?.image_url ? (
                  <img src={i.product.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{i.product?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtTime(i.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function MessageBubble({ message }: { message: any }) {
  const isOutbound = message.direction === "outbound";
  const isInternal = message.is_internal;
  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isInternal
            ? "bg-[color:var(--warning)]/15 text-foreground border border-[color:var(--warning)]/40"
            : isOutbound
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border",
        )}
      >
        {isInternal && <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">Internal note</div>}
        <div className="whitespace-pre-wrap break-words">{message.body}</div>
        <div className={cn("mt-1 text-[10px]", isOutbound && !isInternal ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {fmtTime(message.sent_at)}
        </div>
      </div>
    </div>
  );
}

function SummariseButton({ conversationId, onSuggestion }: { conversationId: string; onSuggestion: (s: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; suggested_reply: string; sentiment: string } | null>(null);
  async function run() {
    setLoading(true);
    try {
      const r: any = await summariseConversation({ data: { conversation_id: conversationId } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally { setLoading(false); }
  }
  return (
    <DropdownMenu onOpenChange={(o) => o && !result && !loading && run()}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-1" /> Summarise
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3 space-y-2">
        {loading || !result ? (
          <div className="text-sm text-muted-foreground">Generating…</div>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary · {result.sentiment}</div>
            <p className="text-sm">{result.summary}</p>
            {result.suggested_reply && (
              <>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-2">Suggested reply</div>
                <p className="text-sm rounded-md border bg-muted/40 p-2">{result.suggested_reply}</p>
                <Button size="sm" className="w-full" onClick={() => onSuggestion(result.suggested_reply)}>
                  Use as reply
                </Button>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
