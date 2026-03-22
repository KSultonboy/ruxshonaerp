import PlatformSettingsPage from "@/components/platforms/PlatformSettingsPage";

export default function PlatformsWebsitePage() {
  return (
    <PlatformSettingsPage
      platformKey="website"
      title="Website"
      subtitle="Platformalar"
      requiredKeys={["url"]}
      fields={[
        { key: "url", label: "Website manzili", placeholder: "Masalan: https://ruxshona.uz", type: "url" },
        { key: "username", label: "Admin login", placeholder: "Masalan: admin" },
      ]}
    />
  );
}
