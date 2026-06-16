import type { ReactNode } from "react";

type InlineAlertProps = {
  title?: string;
  message: ReactNode;
  tone?: "error" | "info";
};

export function InlineAlert({ title, message, tone = "error" }: InlineAlertProps) {
  return (
    <div className={`inline-alert ${tone}`}>
      {title ? <strong>{title}</strong> : null}
      <div>{message}</div>
    </div>
  );
}
