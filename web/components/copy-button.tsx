"use client";
import { useState } from "react";
export function CopyButton({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMessage("コピーしました");
          } catch {
            setMessage(
              "コピーできませんでした。説明文を選択してコピーしてください。",
            );
          }
        }}
      >
        説明文をコピー
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
