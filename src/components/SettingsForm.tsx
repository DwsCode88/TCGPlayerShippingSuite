"use client";

import { useEffect, useState } from "react";
import { fetchUserSettings, saveUserSettings } from "@/lib/userSettings";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/firebase";
import toast from "react-hot-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const inputStyle: React.CSSProperties = {
  background: "white",
  border: "1.5px solid var(--sidebar)",
  borderRadius: "6px",
  padding: "6px 10px",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  color: "var(--foreground)",
};

const inputClassName =
  "focus:outline-none focus:ring-2 focus:ring-[var(--active-color)] focus:ring-offset-0";

const saveBtnStyle: React.CSSProperties = {
  background: "var(--primary-color)",
  color: "white",
  border: "none",
  borderRadius: "6px",
  padding: "5px 14px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  marginTop: "10px",
};

const removeBtnStyle: React.CSSProperties = {
  background: "rgba(220,38,38,0.1)",
  color: "var(--destructive)",
  border: "none",
  borderRadius: "6px",
  padding: "3px 10px",
  fontSize: "12px",
  cursor: "pointer",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--primary-color)",
  border: "1.5px solid var(--primary-color)",
  borderRadius: "6px",
  padding: "5px 14px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  marginTop: "8px",
};

export default function SettingsForm({ user }: { user: any }) {
  const [easypostApiKey, setEasypostApiKey] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [envelopeCost, setEnvelopeCost] = useState(0.0);
  const [shieldCost, setShieldCost] = useState(0.1);
  const [pennySleeveCost, setPennySleeveCost] = useState(0.02);
  const [valueThreshold, setValueThreshold] = useState<number>(0);
  const [topLoaderCost, setTopLoaderCost] = useState(0.12);
  const [usePennySleeves, setUsePennySleeves] = useState(true);
  const [defaultNonMachinable, setDefaultNonMachinable] = useState(false);
  const [cardCountThreshold, setCardCountThreshold] = useState<number>(0);
  const [nonMachinableCardCountThreshold, setNonMachinableCardCountThreshold] = useState<number>(5);

  const [fromAddress, setFromAddress] = useState({
    name: "",
    street1: "",
    city: "",
    state: "",
    zip: "",
  });
  const [packageTypes, setPackageTypes] = useState<any[]>([]);
  const [newPackage, setNewPackage] = useState({
    name: "",
    weight: 1,
    predefined_package: "Letter",
    length: "",
    width: "",
    height: "",
  });

  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showAddPackage, setShowAddPackage] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const settings = await fetchUserSettings(user.uid);
      if (settings) {
        setEasypostApiKey(settings.easypostApiKey || "");
        setLogoUrl(settings.logoUrl || "");
        setEnvelopeCost(settings.envelopeCost || 0.0);
        setShieldCost(settings.shieldCost || 0.1);
        setPennySleeveCost(settings.pennySleeveCost || 0.02);
        setTopLoaderCost(settings.topLoaderCost || 0.12);
        setUsePennySleeves(settings.usePennySleeves ?? true);
        setDefaultNonMachinable(settings.defaultNonMachinable || false);
        setValueThreshold(
          typeof settings.valueThreshold === "number" &&
            settings.valueThreshold > 0
            ? settings.valueThreshold
            : 25
        );
        setFromAddress(
          settings.fromAddress || {
            name: "",
            street1: "",
            city: "",
            state: "",
            zip: "",
          }
        );
        setCardCountThreshold(
          typeof settings.cardCountThreshold === "number" &&
            settings.cardCountThreshold > 0
            ? settings.cardCountThreshold
            : 8
        );
        setNonMachinableCardCountThreshold(
          typeof settings.nonMachinableCardCountThreshold === "number" &&
            settings.nonMachinableCardCountThreshold > 0
            ? settings.nonMachinableCardCountThreshold
            : 5
        );
        setPackageTypes(settings.packageTypes || []);
      }
      setLoading(false);
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    await saveUserSettings(user.uid, {
      easypostApiKey,
      logoUrl,
      envelopeCost,
      shieldCost,
      pennySleeveCost,
      topLoaderCost,
      usePennySleeves,
      defaultNonMachinable,
      fromAddress,
      valueThreshold,
      packageTypes,
      cardCountThreshold,
      nonMachinableCardCountThreshold,
    });
    toast.success("Settings saved!");
  };

  const handleTestKey = async () => {
    setTestResult("⏳ Testing key...");
    try {
      const res = await fetch("/api/test-easypost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: easypostApiKey }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult(data.message);
      } else {
        setTestResult(`❌ Invalid key: ${data.error}`);
      }
    } catch (err) {
      setTestResult("❌ Network or server error.");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const storageRef = ref(storage, `logos/${user.uid}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    setLogoUrl(url);
  };

  const updateAddressField = (field: string, value: string) => {
    setFromAddress((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addPackageType = () => {
    if (!newPackage.name) return;
    setPackageTypes([...packageTypes, newPackage]);
    setNewPackage({
      name: "",
      weight: 1,
      predefined_package: "Letter",
      length: "",
      width: "",
      height: "",
    });
    setShowAddPackage(false);
  };

  const removePackageType = (index: number) => {
    setPackageTypes((prev) => prev.filter((_, i) => i !== index));
  };

  if (!user || loading) {
    return (
      <div className="text-center py-10" style={{ color: "var(--sidebar)" }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2
        className="text-xl font-bold"
        style={{ color: "var(--sidebar-text, #1a2332)" }}
      >
        Settings
      </h2>

      <Accordion multiple={true} className="space-y-2">
        {/* Section 1: EasyPost API Key */}
        <AccordionItem
          value="api-key"
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <AccordionTrigger className="px-4 py-3 text-[13.5px] font-medium hover:no-underline">
            EasyPost API Key
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type={showKey ? "text" : "password"}
                  name="fake-password"
                  autoComplete="new-password"
                  style={inputStyle}
                  className={inputClassName}
                  value={easypostApiKey}
                  placeholder="Enter EasyPost API Key"
                  onChange={(e) => setEasypostApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    fontSize: "12px",
                    color: "var(--primary-color)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={handleTestKey}
                  style={{
                    ...saveBtnStyle,
                    marginTop: 0,
                    background: "var(--sidebar)",
                  }}
                >
                  Test Key
                </button>
                {testResult && (
                  <span style={{ fontSize: "12px", color: "var(--active-color)" }}>
                    {testResult}
                  </span>
                )}
              </div>
              <button type="button" onClick={handleSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: From Address */}
        <AccordionItem
          value="from-address"
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <AccordionTrigger className="px-4 py-3 text-[13.5px] font-medium hover:no-underline">
            From Address
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name"
                style={inputStyle}
                className={inputClassName}
                value={fromAddress.name}
                onChange={(e) => updateAddressField("name", e.target.value)}
              />
              <input
                type="text"
                placeholder="Street"
                style={inputStyle}
                className={inputClassName}
                value={fromAddress.street1}
                onChange={(e) => updateAddressField("street1", e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="City"
                  style={{ ...inputStyle, flex: 1 }}
                  className={inputClassName}
                  value={fromAddress.city}
                  onChange={(e) => updateAddressField("city", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="State"
                  style={{ ...inputStyle, width: "70px", flex: "none" }}
                  className={inputClassName}
                  value={fromAddress.state}
                  onChange={(e) => updateAddressField("state", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="ZIP"
                  style={{ ...inputStyle, width: "80px", flex: "none" }}
                  className={inputClassName}
                  value={fromAddress.zip}
                  onChange={(e) => updateAddressField("zip", e.target.value)}
                />
              </div>
              <button type="button" onClick={handleSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Costs & Supplies */}
        <AccordionItem
          value="costs"
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <AccordionTrigger className="px-4 py-3 text-[13.5px] font-medium hover:no-underline">
            Costs &amp; Supplies
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-3">
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Envelope Cost ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  style={inputStyle}
                  className={inputClassName}
                  value={envelopeCost}
                  onChange={(e) => setEnvelopeCost(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Shield Cost ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  style={inputStyle}
                  className={inputClassName}
                  value={shieldCost}
                  onChange={(e) => setShieldCost(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Penny Sleeve Cost ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  style={inputStyle}
                  className={inputClassName}
                  value={pennySleeveCost}
                  onChange={(e) =>
                    setPennySleeveCost(parseFloat(e.target.value))
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Top Loader Cost ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  style={inputStyle}
                  className={inputClassName}
                  value={topLoaderCost}
                  onChange={(e) => setTopLoaderCost(parseFloat(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="usePennySleeves"
                  checked={usePennySleeves}
                  onCheckedChange={(checked) =>
                    setUsePennySleeves(checked === true)
                  }
                />
                <label
                  htmlFor="usePennySleeves"
                  style={{ fontSize: "13px", cursor: "pointer" }}
                >
                  Use penny sleeves by default
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="defaultNonMachinable"
                  checked={defaultNonMachinable}
                  onCheckedChange={(checked) =>
                    setDefaultNonMachinable(checked === true)
                  }
                />
                <label
                  htmlFor="defaultNonMachinable"
                  style={{ fontSize: "13px", cursor: "pointer" }}
                >
                  Default non-machinable
                </label>
              </div>
              <button type="button" onClick={handleSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 4: Thresholds */}
        <AccordionItem
          value="thresholds"
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <AccordionTrigger className="px-4 py-3 text-[13.5px] font-medium hover:no-underline">
            Thresholds
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-3">
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Value Threshold ($) — orders above this ship Ground Advantage
                </label>
                <input
                  type="number"
                  style={inputStyle}
                  className={inputClassName}
                  value={valueThreshold}
                  onChange={(e) => setValueThreshold(Number(e.target.value))}
                  placeholder="e.g. 25"
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Card Count Threshold — orders above this count ship Ground Advantage
                </label>
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  className={inputClassName}
                  value={cardCountThreshold}
                  onChange={(e) =>
                    setCardCountThreshold(Number(e.target.value))
                  }
                  placeholder="e.g. 8"
                />
              </div>
              <Separator />
              <div>
                <label
                  style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}
                >
                  Non-Machinable Card Count Threshold — orders above this mark envelope non-machinable
                </label>
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  className={inputClassName}
                  value={nonMachinableCardCountThreshold}
                  onChange={(e) =>
                    setNonMachinableCardCountThreshold(Number(e.target.value))
                  }
                  placeholder="e.g. 5"
                />
              </div>
              <button type="button" onClick={handleSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 5: Custom Package Types */}
        <AccordionItem
          value="packages"
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <AccordionTrigger className="px-4 py-3 text-[13.5px] font-medium hover:no-underline">
            Custom Package Types
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-2">
              {packageTypes.length > 0 && (
                <ul className="space-y-1">
                  {packageTypes.map((pkg, i) => (
                    <li
                      key={i}
                      className="flex justify-between items-center rounded px-3 py-2"
                      style={{
                        background: "rgba(0,148,198,0.05)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--foreground)" }}>
                        {pkg.name} – {pkg.weight}oz – {pkg.predefined_package}{" "}
                        – {pkg.length}" x {pkg.width}" x {pkg.height}"
                      </span>
                      <button
                        type="button"
                        onClick={() => removePackageType(i)}
                        style={removeBtnStyle}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!showAddPackage && (
                <button
                  type="button"
                  onClick={() => setShowAddPackage(true)}
                  style={addBtnStyle}
                >
                  + Add Package Type
                </button>
              )}

              {showAddPackage && (
                <div
                  className="space-y-2 p-3 rounded-lg"
                  style={{
                    border: "1px dashed var(--border)",
                    marginTop: "8px",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Package Name"
                    style={inputStyle}
                    className={inputClassName}
                    value={newPackage.name}
                    onChange={(e) =>
                      setNewPackage({ ...newPackage, name: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Weight (oz)"
                      style={inputStyle}
                      className={inputClassName}
                      value={newPackage.weight}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          weight: parseFloat(e.target.value),
                        })
                      }
                    />
                    <select
                      style={inputStyle}
                      value={newPackage.predefined_package}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          predefined_package: e.target.value,
                        })
                      }
                    >
                      <option value="Letter">Letter</option>
                      <option value="Parcel">Parcel</option>
                      <option value="Flat">Flat</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Length (in)"
                      style={inputStyle}
                      className={inputClassName}
                      value={newPackage.length}
                      onChange={(e) =>
                        setNewPackage({ ...newPackage, length: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      placeholder="Width (in)"
                      style={inputStyle}
                      className={inputClassName}
                      value={newPackage.width}
                      onChange={(e) =>
                        setNewPackage({ ...newPackage, width: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      placeholder="Height (in)"
                      style={inputStyle}
                      className={inputClassName}
                      value={newPackage.height}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          height: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addPackageType}
                      style={saveBtnStyle}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddPackage(false)}
                      style={{
                        ...saveBtnStyle,
                        background: "rgba(100,100,100,0.15)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button type="button" onClick={handleSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 6: Logo */}
        <AccordionItem
          value="logo"
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <AccordionTrigger className="px-4 py-3 text-[13.5px] font-medium hover:no-underline">
            Logo
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-3">
              <div
                className="flex flex-col items-center justify-center rounded-lg p-6 text-center"
                style={{
                  border: "2px dashed var(--border)",
                  background: "rgba(0,148,198,0.03)",
                }}
              >
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "10px" }}>
                  Upload PNG or JPG, max 2MB
                </p>
                <label
                  htmlFor="logo-upload"
                  style={{
                    ...saveBtnStyle,
                    display: "inline-block",
                    marginTop: 0,
                    cursor: "pointer",
                  }}
                >
                  Choose File
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleLogoUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Uploaded logo"
                  className="w-32 h-auto rounded"
                  style={{ border: "1px solid var(--border)" }}
                />
              )}
              <button type="button" onClick={handleSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
