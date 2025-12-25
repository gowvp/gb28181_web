import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    console.log("Changing language from", i18n.language, "to", lng);
    i18n.changeLanguage(lng).then(() => {
      console.log("Language changed to:", i18n.language);
      console.log("localStorage:", localStorage.getItem("i18nextLng"));
    });
  };

  const currentLanguage = i18n.language || "zh";
  console.log("Current language in switcher:", currentLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          title={t("common:language")}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          onClick={() => changeLanguage("zh")}
          className={currentLanguage === "zh" ? "bg-accent" : ""}
        >
          <span className="mr-2">🇨🇳</span>
          {t("common:chinese")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage("en")}
          className={currentLanguage === "en" ? "bg-accent" : ""}
        >
          <span className="mr-2">🇺🇸</span>
          {t("common:english")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
