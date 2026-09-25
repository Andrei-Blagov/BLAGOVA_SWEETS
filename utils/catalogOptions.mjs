export function selectedOptions(options, selection) {
  return (options || []).filter(option => selection?.[option.optionGroup] === option.optionKey);
}

export function optionTotal(options, selection) {
  return selectedOptions(options, selection).reduce((sum, option) => sum + option.priceDelta, 0);
}

export function optionConfiguration(selection) {
  return Object.fromEntries(Object.entries(selection || {}).filter(([,key]) => Boolean(key)));
}
