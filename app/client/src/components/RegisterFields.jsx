// The register details (date of birth, guardian, address), shared by the
// Add member and Edit member forms so both always ask the same questions.
import { Field, inputCls } from "./ui.jsx";
import { todayISO } from "../lib/format.js";

export const emptyRegister = { dateOfBirth: "", guardianName: "", guardianPhone: "", address: "" };

export function RegisterFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="space-y-4 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-bold">Register details</legend>
      <Field label="Date of birth">
        <input type="date" className={inputCls} value={value.dateOfBirth} max={todayISO()} onChange={set("dateOfBirth")} />
      </Field>
      <Field label="Parent or guardian's name"><input className={inputCls} value={value.guardianName} onChange={set("guardianName")} /></Field>
      <Field label="Parent or guardian's phone"><input className={inputCls} value={value.guardianPhone} onChange={set("guardianPhone")} inputMode="tel" /></Field>
      <Field label="Home address or village"><input className={inputCls} value={value.address} onChange={set("address")} /></Field>
    </fieldset>
  );
}
