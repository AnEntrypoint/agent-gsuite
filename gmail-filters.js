export function normalizeFilterCriteria(criteria = {}) {
  const out = {};
  if (criteria.from) out.from = criteria.from;
  if (criteria.to) out.to = criteria.to;
  if (criteria.subject) out.subject = criteria.subject;
  if (criteria.query) out.query = criteria.query;
  if (criteria.negated_query) out.negatedQuery = criteria.negated_query;
  if (criteria.negatedQuery) out.negatedQuery = criteria.negatedQuery;
  if (criteria.has_attachment !== undefined) out.hasAttachment = criteria.has_attachment;
  if (criteria.hasAttachment !== undefined) out.hasAttachment = criteria.hasAttachment;
  if (criteria.size !== undefined) out.size = criteria.size;
  if (criteria.size_comparison) out.sizeComparison = criteria.size_comparison;
  if (criteria.sizeComparison) out.sizeComparison = criteria.sizeComparison;
  return out;
}

export function normalizeFilterAction(action = {}) {
  const out = {};
  if (action.add_label_ids) out.addLabelIds = action.add_label_ids;
  if (action.addLabelIds) out.addLabelIds = action.addLabelIds;
  if (action.remove_label_ids) out.removeLabelIds = action.remove_label_ids;
  if (action.removeLabelIds) out.removeLabelIds = action.removeLabelIds;
  if (action.forward) out.forward = action.forward;
  return out;
}
