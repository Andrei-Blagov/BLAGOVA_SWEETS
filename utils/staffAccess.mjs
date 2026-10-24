export const operationalTabs = Object.freeze(['orders', 'conversations', 'calendar']);
export const ownerTabs = Object.freeze([...operationalTabs, 'catalog', 'knowledge', 'integrations']);

export function allowedStaffTabs(role) {
  if (role === 'owner') return ownerTabs;
  if (role === 'manager') return operationalTabs;
  return [];
}

export function canManageCatalog(role) {
  return role === 'owner';
}
