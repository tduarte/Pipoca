// This module has no GNOME imports so it can be unit-tested under Node.

/**
 * `name` is the English name, used in prompts and as the gettext msgid shown
 * in the interface. `chineseName` is used by models prompted in Chinese.
 */
export type Language = {
  code: string;
  flag: string;
  name: string;
  chineseName: string;
};

// Marks a string for translation without translating it here.
const N_ = (text: string): string => text;

// Sorted alphabetically by English name.
export const languages: Language[] = [
  {code: "ar", flag: "🇸🇦", name: N_("Arabic"), chineseName: "阿拉伯语"},
  {code: "bn", flag: "🇧🇩", name: N_("Bengali"), chineseName: "孟加拉语"},
  {code: "zh", flag: "🇨🇳", name: N_("Chinese"), chineseName: "中文"},
  {code: "nl", flag: "🇳🇱", name: N_("Dutch"), chineseName: "荷兰语"},
  {code: "en", flag: "🇺🇸", name: N_("English"), chineseName: "英语"},
  {code: "fr", flag: "🇫🇷", name: N_("French"), chineseName: "法语"},
  {code: "de", flag: "🇩🇪", name: N_("German"), chineseName: "德语"},
  {code: "el", flag: "🇬🇷", name: N_("Greek"), chineseName: "希腊语"},
  {code: "hi", flag: "🇮🇳", name: N_("Hindi"), chineseName: "印地语"},
  {code: "it", flag: "🇮🇹", name: N_("Italian"), chineseName: "意大利语"},
  {code: "ja", flag: "🇯🇵", name: N_("Japanese"), chineseName: "日语"},
  {code: "ko", flag: "🇰🇷", name: N_("Korean"), chineseName: "韩语"},
  {code: "pl", flag: "🇵🇱", name: N_("Polish"), chineseName: "波兰语"},
  {code: "pt", flag: "🇵🇹", name: N_("Portuguese"), chineseName: "葡萄牙语"},
  {
    code: "pt-BR",
    flag: "🇧🇷",
    name: N_("Portuguese (Brazil)"),
    chineseName: "巴西葡萄牙语",
  },
  {code: "ru", flag: "🇷🇺", name: N_("Russian"), chineseName: "俄语"},
  {code: "es", flag: "🇪🇸", name: N_("Spanish"), chineseName: "西班牙语"},
  {code: "th", flag: "🇹🇭", name: N_("Thai"), chineseName: "泰语"},
  {code: "tr", flag: "🇹🇷", name: N_("Turkish"), chineseName: "土耳其语"},
  {code: "uk", flag: "🇺🇦", name: N_("Ukrainian"), chineseName: "乌克兰语"},
  {code: "vi", flag: "🇻🇳", name: N_("Vietnamese"), chineseName: "越南语"},
];
