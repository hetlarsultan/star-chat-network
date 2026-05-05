import { ArrowDown } from "lucide-react";

interface Props {
  onClick: () => void;
}

const NewMessagesIndicator = ({ onClick }: Props) => (
  <button
    onClick={onClick}
    className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 bg-accent text-accent-foreground rounded-full px-4 py-1.5 shadow-lg flex items-center gap-2 text-xs font-cairo font-bold animate-bounce"
  >
    <ArrowDown className="w-4 h-4" />
    رسائل جديدة
  </button>
);

export default NewMessagesIndicator;
