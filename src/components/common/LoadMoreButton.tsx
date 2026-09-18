import React from "react";

const LoadMoreButton: React.FC<{ shown: number; total: number; onClick: () => void }> = ({ shown, total, onClick }) =>
  shown < total ? <button type="button" onClick={onClick} className="w-full border border-[var(--border-main)] py-3 text-[10px] font-mono text-[var(--text-muted)] hover:border-[var(--point-color)] hover:text-[var(--point-color)]">더 보기 ({shown}/{total})</button> : null;

export default LoadMoreButton;
