import { exec } from "child_process";
import { promisify } from "util";
import { FormTemplate, FormData } from "./types.js";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { setTimeout } from "timers/promises";
import { existsSync } from "fs";
const formDir = import.meta.dirname + "/../forms";

if (!existsSync(`${formDir}/filled`)) {
  await mkdir(`${formDir}/filled`);
}

const cmd = promisify(exec);
const parser = new XMLParser({ ignoreAttributes: false });
const builder = new XMLBuilder({ ignoreAttributes: false });
const XMLFile = await readFile(`${formDir}/form.xfdf`);
const xml = parser.parse(XMLFile) as FormTemplate;

async function createXMLForm(data: FormData): Promise<string | null> {
  const template = structuredClone(xml);
  for (const field of template.xfdf.fields.field) {
    field.value = data[field["@_name"]] ?? "";
  }
  const newXml = builder.build(template) as string;
  const filename = randomUUID();
  try {
    await writeFile(`${formDir}/filled/${filename}`, newXml);
    return filename;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function fillForm(form: string) {
  try {
    const { stdout, stderr } = await cmd(
      `java -jar pdftk-all.jar ${formDir}/service.pdf fill_form ${formDir}/filled/${form} output ${formDir}/filled/${form}.pdf need_appearances`
    );
    return `${form}.pdf`;
  } catch (error) {
    console.log(error);
    return null;
  } finally {
    rm(`${formDir}/filled/${form}`);
  }
}

export async function createPDFForm(data: FormData) {
  const form = await createXMLForm(data);
  if (!form) return null;
  const filename = await fillForm(form);
  if (!filename) return null;
  setTimeout(5 * 60 * 1000).then(() => rm(`${formDir}/filled/${filename}`));
  return filename;
}
