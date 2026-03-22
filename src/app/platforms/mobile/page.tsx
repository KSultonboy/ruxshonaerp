import PlatformSettingsPage from "@/components/platforms/PlatformSettingsPage";

export default function PlatformsMobilePage() {
  return (
    <PlatformSettingsPage
      platformKey="mobile"
      title="Mobile app"
      subtitle="Platformalar"
      requiredKeys={["packageId"]}
      fields={[
        { key: "packageId", label: "Package ID", placeholder: "Masalan: com.ruxshona.erp" },
        { key: "url", label: "Store link", placeholder: "Masalan: https://play.google.com/..." },
      ]}
    />
  );
}
