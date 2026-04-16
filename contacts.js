import { getPeopleClient } from './google-clients.js';

const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,organizations,addresses,biographies,urls';

export async function listContacts(auth, opts = {}) {
  const svc = getPeopleClient(auth);
  const { page_size = 100, page_token, sort_order } = opts;
  const params = { resourceName: 'people/me', personFields: PERSON_FIELDS, pageSize: page_size };
  if (page_token) params.pageToken = page_token;
  if (sort_order) params.sortOrder = sort_order;
  const res = await svc.people.connections.list(params);
  return {
    contacts: (res.data.connections || []).map(formatContact),
    nextPageToken: res.data.nextPageToken || null,
    totalItems: res.data.totalItems || 0
  };
}

export async function getContact(auth, resourceName) {
  const svc = getPeopleClient(auth);
  const res = await svc.people.get({ resourceName, personFields: PERSON_FIELDS });
  return formatContact(res.data);
}

export async function searchContacts(auth, query, opts = {}) {
  const svc = getPeopleClient(auth);
  const { page_size = 30 } = opts;
  const res = await svc.people.searchContacts({ query, readMask: PERSON_FIELDS, pageSize: page_size });
  return (res.data.results || []).map(r => formatContact(r.person));
}

export async function manageContact(auth, opts) {
  const svc = getPeopleClient(auth);
  const { action, resource_name } = opts;

  if (action === 'create') {
    const body = buildPersonBody(opts);
    const res = await svc.people.createContact({ requestBody: body, personFields: PERSON_FIELDS });
    return formatContact(res.data);
  }
  if (action === 'update') {
    const existing = await svc.people.get({ resourceName: resource_name, personFields: PERSON_FIELDS });
    const body = buildPersonBody(opts, existing.data);
    body.etag = existing.data.etag;
    const res = await svc.people.updateContact({
      resourceName: resource_name, requestBody: body,
      updatePersonFields: PERSON_FIELDS, personFields: PERSON_FIELDS
    });
    return formatContact(res.data);
  }
  if (action === 'delete') {
    await svc.people.deleteContact({ resourceName: resource_name });
    return { deleted: resource_name };
  }
  throw new Error(`Unknown contact action: ${action}`);
}

export async function listContactGroups(auth, opts = {}) {
  const svc = getPeopleClient(auth);
  const { page_size = 200 } = opts;
  const res = await svc.contactGroups.list({ pageSize: page_size, groupFields: 'name,groupType,memberCount' });
  return (res.data.contactGroups || []).map(g => ({
    resourceName: g.resourceName, name: g.name, groupType: g.groupType,
    memberCount: g.memberCount || 0
  }));
}

export async function getContactGroup(auth, resourceName) {
  const svc = getPeopleClient(auth);
  const res = await svc.contactGroups.get({ resourceName, groupFields: 'name,groupType,memberCount' });
  return { resourceName: res.data.resourceName, name: res.data.name, groupType: res.data.groupType, memberCount: res.data.memberCount || 0 };
}

export async function manageContactsBatch(auth, opts) {
  const svc = getPeopleClient(auth);
  const { action, resource_names = [], group_resource_name } = opts;

  if (action === 'add_to_group') {
    await svc.contactGroups.members.modify({
      resourceName: group_resource_name,
      requestBody: { resourceNamesToAdd: resource_names }
    });
    return { added: resource_names.length };
  }
  if (action === 'remove_from_group') {
    await svc.contactGroups.members.modify({
      resourceName: group_resource_name,
      requestBody: { resourceNamesToRemove: resource_names }
    });
    return { removed: resource_names.length };
  }
  throw new Error(`Unknown batch action: ${action}`);
}

export async function manageContactGroup(auth, opts) {
  const svc = getPeopleClient(auth);
  const { action, resource_name, name } = opts;

  if (action === 'create') {
    const res = await svc.contactGroups.create({ requestBody: { contactGroup: { name } } });
    return { resourceName: res.data.resourceName, name: res.data.name };
  }
  if (action === 'update') {
    const res = await svc.contactGroups.update({
      resourceName: resource_name,
      requestBody: { contactGroup: { name }, updateGroupFields: 'name' }
    });
    return { resourceName: res.data.resourceName, name: res.data.name };
  }
  if (action === 'delete') {
    await svc.contactGroups.delete({ resourceName: resource_name, deleteContacts: false });
    return { deleted: resource_name };
  }
  throw new Error(`Unknown contact group action: ${action}`);
}

function buildPersonBody(opts, existing = {}) {
  const body = {};
  if (opts.given_name || opts.family_name) {
    body.names = [{ givenName: opts.given_name || '', familyName: opts.family_name || '' }];
  } else if (existing.names) {
    body.names = existing.names;
  }
  if (opts.emails) {
    body.emailAddresses = opts.emails.map(e => typeof e === 'string' ? { value: e } : e);
  } else if (existing.emailAddresses) {
    body.emailAddresses = existing.emailAddresses;
  }
  if (opts.phones) {
    body.phoneNumbers = opts.phones.map(p => typeof p === 'string' ? { value: p } : p);
  } else if (existing.phoneNumbers) {
    body.phoneNumbers = existing.phoneNumbers;
  }
  if (opts.organization) {
    body.organizations = [typeof opts.organization === 'string' ? { name: opts.organization } : opts.organization];
  } else if (existing.organizations) {
    body.organizations = existing.organizations;
  }
  return body;
}

function formatContact(p) {
  if (!p) return null;
  const name = p.names?.[0] || {};
  return {
    resourceName: p.resourceName,
    displayName: name.displayName || `${name.givenName || ''} ${name.familyName || ''}`.trim(),
    emails: (p.emailAddresses || []).map(e => e.value),
    phones: (p.phoneNumbers || []).map(ph => ph.value),
    organization: p.organizations?.[0]?.name || null
  };
}
