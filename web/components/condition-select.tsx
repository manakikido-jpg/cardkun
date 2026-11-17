"use client";
export function ConditionSelect({ condition }: { condition: string }) {
  return (
    <label>
      状態
      <select
        name="condition"
        defaultValue={condition}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="A">A · 良好</option>
        <option value="B">B · 軽い傷あり</option>
        <option value="C">C · 目立つ傷あり</option>
        <option value="D">D · 大きな傷・折れあり</option>
      </select>
    </label>
  );
}
