import { FileText, Image as ImageIcon, FileArchive, Download, File } from "lucide-react";

export interface FunnelAttachment {
  id: string;
  funnel_id: string;
  step_id: string | null;
  name: string;
  file_url: string;
  file_path?: string | null;
  file_type: string; // 'pdf' | 'image' | 'doc' | 'other'
  file_size: number | null;
  position: number;
}

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

interface Props {
  attachments: FunnelAttachment[];
  title?: string;
  isDark?: boolean;
}

export const AttachmentsList = ({ attachments, title = "Materials & Resources", isDark = true }: Props) => {
  if (!attachments || attachments.length === 0) return null;

  const bg = isDark ? "#141419" : "#f8f9fa";
  const border = isDark ? "#27272a" : "#e5e7eb";
  const text = isDark ? "#ffffff" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#64748b";
  const itemBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";

  return (
    <div className="rounded-2xl p-5" style={{ background: bg, border: `1px solid ${border}` }}>
      <h3 className="font-heading font-bold text-[16px] mb-3.5 flex items-center gap-2" style={{ color: text }}>
        <Download size={16} className="text-primary" />
        {title}
      </h3>
      <div className="space-y-2">
        {attachments.map((att) => {
          const Icon = iconFor(att.file_type);
          return (
            <a
              key={att.id}
              href={att.file_url}
              download={att.name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-primary/5 group"
              style={{ background: itemBg, border: `1px solid ${border}` }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(212,175,55,0.12)" }}
              >
                <Icon size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate" style={{ color: text }}>
                  {att.name}
                </p>
                {att.file_size ? (
                  <p className="text-[12px]" style={{ color: muted }}>
                    {fmtSize(att.file_size)} · Tap to download
                  </p>
                ) : (
                  <p className="text-[12px]" style={{ color: muted }}>Tap to download</p>
                )}
              </div>
              <Download size={16} className="text-primary/70 group-hover:text-primary shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
};
