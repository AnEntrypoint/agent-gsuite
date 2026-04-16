import * as calendar from './calendar.js';
import { formatJsonResponse } from './handlers-utils.js';

export async function handleCalendarToolCall(name, args, auth) {
  switch (name) {
    case 'calendar_list': return formatJsonResponse(await calendar.listCalendars(auth));
    case 'calendar_get_events': return formatJsonResponse(await calendar.getEvents(auth, args));
    case 'calendar_manage_event': return formatJsonResponse(await calendar.manageEvent(auth, args));
    case 'calendar_freebusy': return formatJsonResponse(await calendar.queryFreebusy(auth, args));
    case 'calendar_create': return formatJsonResponse(await calendar.createCalendar(auth, args));
    case 'calendar_out_of_office': return formatJsonResponse(await calendar.manageOutOfOffice(auth, args));
    case 'calendar_focus_time': return formatJsonResponse(await calendar.manageFocusTime(auth, args));
    default: return null;
  }
}
