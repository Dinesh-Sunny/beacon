import type { ArrayField, Field, TextFieldSingleValidation } from "payload";
import { parseSiteHref } from "@/lib/site-href";

export const LINK_APPEARANCES = ["primary", "secondary"] as const;
export type LinkAppearance = (typeof LINK_APPEARANCES)[number];

const MAX_LABEL_LENGTH = 40;

const validateHref: TextFieldSingleValidation = (value, { required }) => {
  if (!value) return required ? "Add a link." : true;
  return parseSiteHref(value)
    ? true
    : "Use a site path like /about, an https:// address, or mailto:.";
};

function linkFields(appearance: boolean): Field[] {
  const fields: Field[] = [
    {
      type: "row",
      fields: [
        {
          name: "label",
          type: "text",
          required: true,
          maxLength: MAX_LABEL_LENGTH,
          admin: { width: "50%" },
        },
        {
          name: "href",
          label: "Link",
          type: "text",
          required: true,
          validate: validateHref,
          admin: { width: "50%", placeholder: "/about or https://example.com" },
        },
      ],
    },
  ];
  if (appearance) {
    fields.push({
      name: "appearance",
      type: "select",
      required: true,
      defaultValue: "primary",
      options: [...LINK_APPEARANCES],
      admin: {
        description: "Primary is the main action. Use it once per section.",
      },
    });
  }
  return fields;
}

// Every CMS link (blocks, navigation) has this shape, so hrefs are always checked by
// parseSiteHref: only site paths, https, and mailto reach a page. Optional links are arrays
// with maxRows, since a group can't be optional when its fields are required.
export function linkArray(
  name: string,
  options: { maxRows: number; minRows?: number; appearance?: boolean },
): ArrayField {
  const appearance = options.appearance ?? false;
  return {
    name,
    type: "array",
    interfaceName: appearance ? "ActionLink" : "SiteLink",
    minRows: options.minRows,
    maxRows: options.maxRows,
    labels: { singular: "Link", plural: "Links" },
    admin: { initCollapsed: false },
    fields: linkFields(appearance),
  };
}
