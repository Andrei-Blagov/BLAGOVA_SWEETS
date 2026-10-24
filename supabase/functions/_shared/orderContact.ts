export function validOrderContact(value: string): boolean {
  const contact = value.trim();
  if (!contact || contact.length > 120) return false;
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(contact)) return true;
  const digits = contact.replace(/\D/g, '');
  return /^\+?[0-9][0-9 ()-]*$/.test(contact) && digits.length >= 7 && digits.length <= 15;
}
