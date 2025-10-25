const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s\-().]{6,}\d)/g;
const HANDLE_REGEX = /@([a-z0-9_]{2,15})/gi;

const stripHtmlTags = (input: string) => input.replace(/<[^>]+>/g, " ");

const collapseWhitespace = (input: string) => input.replace(/\s+/g, " ").trim();

const redactHandles = (text: string, enable: boolean) => {
  if (!enable) {
    return text;
  }
  return text.replace(HANDLE_REGEX, "@user");
};

export interface NormalizationOptions {
  redactHandles?: boolean;
}

export const normalizeText = (input: string, options: NormalizationOptions = {}) => {
  const withoutHtml = stripHtmlTags(input);
  const withoutEmails = withoutHtml.replace(EMAIL_REGEX, "[redacted-email]");
  const withoutPhones = withoutEmails.replace(PHONE_REGEX, "[redacted-phone]");
  const cleaned = collapseWhitespace(withoutPhones);
  return redactHandles(cleaned, options.redactHandles ?? false);
};

export const truncateText = (input: string, maxLength: number) => {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength - 3)}...`;
};
