import PlatformSettingsPage from "@/components/platforms/PlatformSettingsPage";

export default function PlatformsTelegramPage() {
  return (
    <PlatformSettingsPage
      platformKey="telegram"
      title="Telegram bot"
      subtitle="Platformalar"
      requiredKeys={["token"]}
      fields={[
        { key: "token", label: "Bot token", placeholder: "Masalan: 123456:ABC", type: "password" },
        { key: "username", label: "Bot username", placeholder: "Masalan: ruxshona_bot" },
      ]}
    />
  );
}
