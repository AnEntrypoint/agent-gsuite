import { getCalendarClient } from './google-clients.js';

export async function listCalendars(auth) {
  const cal = getCalendarClient(auth);
  const res = await cal.calendarList.list();
  const items = res.data.items || [];
  return items.map(c => ({
    id: c.id,
    summary: c.summary || 'No Summary',
    primary: !!c.primary,
    accessRole: c.accessRole,
    timeZone: c.timeZone
  }));
}

export async function getEvents(auth, opts = {}) {
  const cal = getCalendarClient(auth);
  const {
    calendar_id = 'primary', event_id, time_min, time_max,
    max_results = 25, query, detailed = false
  } = opts;

  if (event_id) {
    const res = await cal.events.get({ calendarId: calendar_id, eventId: event_id });
    return detailed ? formatEventDetailed(res.data) : formatEventBasic(res.data);
  }

  const params = {
    calendarId: calendar_id,
    timeMin: time_min || new Date().toISOString(),
    maxResults: max_results,
    singleEvents: true,
    orderBy: 'startTime'
  };
  if (time_max) params.timeMax = time_max;
  if (query) params.q = query;

  const res = await cal.events.list(params);
  const items = res.data.items || [];
  return items.map(e => detailed ? formatEventDetailed(e) : formatEventBasic(e));
}

export async function manageEvent(auth, opts) {
  const cal = getCalendarClient(auth);
  const { action, calendar_id = 'primary', event_id, send_updates = 'none' } = opts;

  if (action === 'create') return createEvent(cal, opts);
  if (action === 'update') return updateEvent(cal, opts);
  if (action === 'delete') {
    await cal.events.delete({ calendarId: calendar_id, eventId: event_id, sendUpdates: send_updates });
    return { deleted: event_id };
  }
  if (action === 'rsvp') return rsvpEvent(cal, opts);
  throw new Error(`Unknown calendar action: ${action}. Use create, update, delete, or rsvp.`);
}

async function createEvent(cal, opts) {
  const body = buildEventBody(opts);
  const params = { calendarId: opts.calendar_id || 'primary', requestBody: body };
  if (opts.send_updates) params.sendUpdates = opts.send_updates;
  if (opts.add_google_meet) params.conferenceDataVersion = 1;
  const res = await cal.events.insert(params);
  return formatEventDetailed(res.data);
}

async function updateEvent(cal, opts) {
  const { calendar_id = 'primary', event_id, send_updates = 'none' } = opts;
  const existing = await cal.events.get({ calendarId: calendar_id, eventId: event_id });
  const body = { ...existing.data, ...buildEventBody(opts, existing.data) };
  const params = { calendarId: calendar_id, eventId: event_id, requestBody: body, sendUpdates: send_updates };
  if (opts.add_google_meet) params.conferenceDataVersion = 1;
  const res = await cal.events.update(params);
  return formatEventDetailed(res.data);
}

async function rsvpEvent(cal, opts) {
  const { calendar_id = 'primary', event_id, response = 'accepted', send_updates = 'none' } = opts;
  const existing = await cal.events.get({ calendarId: calendar_id, eventId: event_id });
  const body = existing.data;
  const attendees = body.attendees || [];
  const self = attendees.find(a => a.self);
  if (self) self.responseStatus = response;
  const res = await cal.events.patch({
    calendarId: calendar_id, eventId: event_id,
    requestBody: { attendees }, sendUpdates: send_updates
  });
  return formatEventDetailed(res.data);
}

function buildEventBody(opts, existing = {}) {
  const body = {};
  if (opts.summary) body.summary = opts.summary;
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.location !== undefined) body.location = opts.location;

  if (opts.start_time) {
    body.start = opts.start_time.includes('T')
      ? { dateTime: opts.start_time } : { date: opts.start_time };
    if (opts.timezone && body.start.dateTime) body.start.timeZone = opts.timezone;
  }
  if (opts.end_time) {
    body.end = opts.end_time.includes('T')
      ? { dateTime: opts.end_time } : { date: opts.end_time };
    if (opts.timezone && body.end.dateTime) body.end.timeZone = opts.timezone;
  }

  if (opts.attendees) {
    body.attendees = (Array.isArray(opts.attendees) ? opts.attendees : [opts.attendees])
      .map(a => typeof a === 'string' ? { email: a } : a);
  }
  if (opts.recurrence) body.recurrence = opts.recurrence;
  if (opts.transparency) body.transparency = opts.transparency;
  if (opts.visibility) body.visibility = opts.visibility;
  if (opts.color_id) body.colorId = opts.color_id;

  if (opts.add_google_meet) {
    body.conferenceData = {
      createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } }
    };
  }

  if (opts.reminders) {
    body.reminders = { useDefault: false, overrides: opts.reminders };
  } else if (opts.use_default_reminders !== undefined) {
    body.reminders = { useDefault: opts.use_default_reminders };
  }

  if (opts.guests_can_modify !== undefined) body.guestsCanModify = opts.guests_can_modify;
  if (opts.guests_can_invite_others !== undefined) body.guestsCanInviteOthers = opts.guests_can_invite_others;
  if (opts.guests_can_see_other_guests !== undefined) body.guestsCanSeeOtherGuests = opts.guests_can_see_other_guests;

  return body;
}

export async function queryFreebusy(auth, opts) {
  const cal = getCalendarClient(auth);
  const { time_min, time_max, calendar_ids = ['primary'] } = opts;
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: time_min, timeMax: time_max,
      items: calendar_ids.map(id => ({ id }))
    }
  });
  return res.data.calendars;
}

export async function createCalendar(auth, opts) {
  const cal = getCalendarClient(auth);
  const body = { summary: opts.summary };
  if (opts.description) body.description = opts.description;
  if (opts.timezone) body.timeZone = opts.timezone;
  const res = await cal.calendars.insert({ requestBody: body });
  return { id: res.data.id, summary: res.data.summary };
}

export async function manageOutOfOffice(auth, opts) {
  const cal = getCalendarClient(auth);
  const { action, calendar_id = 'primary' } = opts;

  if (action === 'list') {
    const params = {
      calendarId: calendar_id, singleEvents: true, orderBy: 'startTime',
      maxResults: opts.max_results || 10, eventTypes: ['outOfOffice']
    };
    if (opts.time_min) params.timeMin = opts.time_min;
    if (opts.time_max) params.timeMax = opts.time_max;
    const res = await cal.events.list(params);
    return (res.data.items || []).map(formatEventBasic);
  }
  if (action === 'create') {
    const body = {
      eventType: 'outOfOffice', summary: opts.summary || 'Out of Office',
      start: { dateTime: opts.start_time }, end: { dateTime: opts.end_time }
    };
    if (opts.timezone) { body.start.timeZone = opts.timezone; body.end.timeZone = opts.timezone; }
    if (opts.recurrence) body.recurrence = opts.recurrence;
    if (opts.auto_decline_mode) body.outOfOfficeProperties = { autoDeclineMode: opts.auto_decline_mode, declineMessage: opts.decline_message || '' };
    const res = await cal.events.insert({ calendarId: calendar_id, requestBody: body });
    return formatEventDetailed(res.data);
  }
  if (action === 'delete') {
    await cal.events.delete({ calendarId: calendar_id, eventId: opts.event_id });
    return { deleted: opts.event_id };
  }
  throw new Error(`Unknown OOO action: ${action}. Use list, create, or delete.`);
}

export async function manageFocusTime(auth, opts) {
  const cal = getCalendarClient(auth);
  const { action, calendar_id = 'primary' } = opts;

  if (action === 'list') {
    const params = {
      calendarId: calendar_id, singleEvents: true, orderBy: 'startTime',
      maxResults: opts.max_results || 10, eventTypes: ['focusTime']
    };
    if (opts.time_min) params.timeMin = opts.time_min;
    if (opts.time_max) params.timeMax = opts.time_max;
    const res = await cal.events.list(params);
    return (res.data.items || []).map(formatEventBasic);
  }
  if (action === 'create') {
    const body = {
      eventType: 'focusTime', summary: opts.summary || 'Focus Time',
      start: { dateTime: opts.start_time }, end: { dateTime: opts.end_time }
    };
    if (opts.timezone) { body.start.timeZone = opts.timezone; body.end.timeZone = opts.timezone; }
    if (opts.recurrence) body.recurrence = opts.recurrence;
    if (opts.auto_decline_mode) body.focusTimeProperties = { autoDeclineMode: opts.auto_decline_mode, declineMessage: opts.decline_message || '', chatStatus: opts.chat_status || 'DO_NOT_DISTURB' };
    const res = await cal.events.insert({ calendarId: calendar_id, requestBody: body });
    return formatEventDetailed(res.data);
  }
  if (action === 'delete') {
    await cal.events.delete({ calendarId: calendar_id, eventId: opts.event_id });
    return { deleted: opts.event_id };
  }
  throw new Error(`Unknown focus time action: ${action}. Use list, create, or delete.`);
}

function formatEventBasic(e) {
  return {
    id: e.id,
    summary: e.summary || 'No Title',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    link: e.htmlLink
  };
}

function formatEventDetailed(e) {
  const base = formatEventBasic(e);
  return {
    ...base,
    description: e.description || '',
    location: e.location || '',
    attendees: (e.attendees || []).map(a => ({
      email: a.email, responseStatus: a.responseStatus, organizer: !!a.organizer
    })),
    meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || null,
    colorId: e.colorId || null,
    recurrence: e.recurrence || null,
    status: e.status
  };
}
