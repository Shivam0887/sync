import type { PickerProps } from "emoji-picker-react";

import { useTheme } from "@/hooks/use-theme";
import EmojiPicker, { Theme, EmojiStyle } from "emoji-picker-react";
import { memo } from "react";

const Picker = memo((props: PickerProps) => {
  const { theme } = useTheme();
  return (
    <EmojiPicker
      theme={
        theme === "dark"
          ? Theme.DARK
          : theme === "light"
          ? Theme.LIGHT
          : Theme.AUTO
      }
      emojiStyle={EmojiStyle.NATIVE}
      previewConfig={{ showPreview: false }}
      skinTonesDisabled
      lazyLoadEmojis
      className="!w-full"
      {...props}
    />
  );
});

export default Picker;
