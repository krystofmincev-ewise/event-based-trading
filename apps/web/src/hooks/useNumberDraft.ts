import type { ChangeEvent, KeyboardEvent } from "react";
import { useState } from "react";

interface NumberDraftOptions {
  value: number;
  minimum: number;
  maximum: number;
  isAllowed?: (value: number) => boolean;
  onValidChange: (value: number) => void;
}

export const useNumberDraft = ({
  value,
  minimum,
  maximum,
  isAllowed = () => true,
  onValidChange,
}: NumberDraftOptions) => {
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const visibleValue = isEditing ? draft : String(value);
  const parsedDraft = Number(visibleValue);
  const isValid =
    !isEditing ||
    (visibleValue.trim().length > 0 &&
      Number.isFinite(parsedDraft) &&
      parsedDraft >= minimum &&
      parsedDraft <= maximum &&
      isAllowed(parsedDraft));

  const onFocus = () => {
    setDraft(String(value));
    setIsEditing(true);
  };
  const onBlur = () => setIsEditing(false);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDraft = event.target.value;
    const parsed = Number(nextDraft);
    setDraft(nextDraft);
    if (
      nextDraft.trim().length > 0 &&
      Number.isFinite(parsed) &&
      parsed >= minimum &&
      parsed <= maximum &&
      isAllowed(parsed)
    ) {
      onValidChange(parsed);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsEditing(false);
      event.currentTarget.blur();
    }
  };

  return { visibleValue, isValid, onFocus, onBlur, onChange, onKeyDown };
};
