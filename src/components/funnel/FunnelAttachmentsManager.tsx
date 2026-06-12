import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Image as ImageIcon, FileArchive, File, Loader2, Pencil, Check, X } from "lucide-react";

interface Props {
  funnelId: string;
  /** Pass to scope materials to a specific step (multi-step funnels). Leave undefined for funnel-level materials. */
  stepId?: string | null;
  title?: string;
  description?: string;
}

const MAX_FILE_MB = 25;

const getFileType = (mime: string, name: string): string => {
  const lc = name.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || lc.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("word") ||
    mime.includes("officedocument") ||
    /\.(docx?|pptx?|xlsx?|txt|csv)$/i.test(lc)
  )
    return "doc";
  return "other";
};

const iconFor = (t: string) => {
  if (t === "image") return ImageIcon;
  if (t === "pdf") return FileText;
  if (t === "doc") return FileArchive;
  return File;
};

const fmtSize = (b?: number | null) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export const FunnelAttachmentsManager = ({
  funnelId,
  stepId = null,
  title = "Materials & Resources",
  description = "Upload PDFs, images, or documents that leads can download from this page.",
}: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const queryKey = ["funnel-attachments", funnelId, stepId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("funnel_attachments")
        .select("*")
        .eq("funnel_id", funnelId)
        .order("position");
      q = stepId ? q.eq("step_id", stepId) : q.is("step_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!funnelId,
  });

  const uploadFiles = async (files: FileList) => {
    if (!user) {
      toast.error("Please sign in to upload");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          toast.error(`${file.name} is larger than ${MAX_FILE_MB} MB`);
          continue;
        }
        const cleanName = file.name.toLowerCase().replace(/[^a-z0-9.\-]/g, "-");
        const path = `${user.id}/${funnelId}/${Date.now()}-${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from("funnel-attachments")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from("funnel-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);

        const { error: insErr } = await supabase.from("funnel_attachments").insert({
          funnel_id: funnelId,
          step_id: stepId,
          owner_id: user.id,
          name: file.name,
          file_url: signed?.signedUrl || "",
          file_path: path,
          file_type: getFileType(file.type, file.name),
          file_size: file.size,
          position: attachments.length,
        });
        if (insErr) {
          toast.error(`${file.name}: ${insErr.message}`);
        }
      }
      queryClient.invalidateQueries({ queryKey });
      toast.success("Files uploaded");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (att: any) => {
      if (att.file_path) {
        await supabase.storage.from("funnel-attachments").remove([att.file_path]);
      }
      const { error } = await supabase.from("funnel_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Attachment removed");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to remove"),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("funnel_attachments").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-heading font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div
        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,image/*"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-6 h-6" />
            <p className="text-sm">
              <span className="text-primary font-medium">Click to upload</span> or drag &amp; drop
            </p>
            <p className="text-[11px]">PDF, DOC, PPT, XLS, images · up to {MAX_FILE_MB} MB each</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No materials uploaded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att: any) => {
            const Icon = iconFor(att.file_type);
            const isEditing = editingId === att.id;
            return (
              <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => renameMutation.mutate({ id: att.id, name: editName.trim() || att.name })}
                      >
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">{att.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {att.file_type.toUpperCase()} · {fmtSize(att.file_size)}
                      </p>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingId(att.id);
                        setEditName(att.name);
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Remove "${att.name}"?`)) deleteMutation.mutate(att);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
