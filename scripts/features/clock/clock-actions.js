/**
 * Intoterica Clock Actions
 * Date calculation and world clock management
 */

import { hasPermission } from "../../core/permissions.js";
import { createDialog, getFormData } from "../../core/dialog.js";

/**
 * Formats and returns the in-game date according to SimpleCalendar, Calendaria, worldTime, or custom clock.
 * @returns {string}
 */
export function getGameDate() {
  const useWorldClock = game.settings.get('intoterica', 'useWorldClock');
  
  if (useWorldClock) {
    if (window.SimpleCalendar?.api) {
      const date = SimpleCalendar.api.timestampToDate(game.time.worldTime);
      return SimpleCalendar.api.formatDateTime(date);
    } else if (game.modules.get('calendaria')?.active) {
      const calendariaModule = game.modules.get('calendaria');
      const cal = window.Calendaria || window.CALENDARIA || game.calendaria || calendariaModule.api;
      
      if (cal) {
          const api = cal.api || cal;
          
          if (typeof api.formatDate === 'function') {
              const dateStr = api.formatDate(null, 'dateLong');
              
              let timeStr = "";
              if (typeof api.getCurrentDateTime === 'function') {
                  const now = api.getCurrentDateTime();
                  if (now) timeStr = `${now.hour.toString().padStart(2, '0')}:${now.minute.toString().padStart(2, '0')}`;
              }
              
              return `${dateStr} ${timeStr}`;
          }
          
          if (typeof api.getDate === 'function') return api.getDate();
          if (typeof api.getDisplayDate === 'function') return api.getDisplayDate();
          if (typeof api.getDateTime === 'function') return api.getDateTime();
          
          let d = null;
          if (cal.currentDate) d = cal;
          else if (cal.data?.currentDate) d = cal.data;
          else if (cal.api?.currentDate) d = cal.api;
          else if (cal.system?.currentDate) d = cal.system;
          else if (cal.state?.currentDate) d = cal.state;
          
          if (!d && cal.CalendarManager) {
              d = cal.CalendarManager.activeCalendar || 
                  cal.CalendarManager.visibleCalendar || 
                  cal.CalendarManager.currentCalendar;
              
              if (!d && Array.isArray(cal.CalendarManager.calendars)) {
                  d = cal.CalendarManager.calendars[0];
              }
          }

          if (d && d.currentDate) {
              const c = d.currentDate;
              let monthName = c.month;
              
              const months = d.months?.values || d.months;
              if (Array.isArray(months)) {
                  const monthData = months.find(m => m.ordinal === c.month) || months.find(m => m.numericRepresentation === c.month);
                  if (monthData) monthName = monthData.name;
              }
              
              const time = (c.hour !== undefined && c.minute !== undefined) 
                  ? ` ${c.hour.toString().padStart(2, '0')}:${c.minute.toString().padStart(2, '0')}` 
                  : '';
              
              return `${monthName} ${c.day}, ${c.year}${time}`;
          }

          if (typeof cal.toString === 'function') {
              const str = cal.toString();
              if (str !== '[object Object]' && !str.startsWith('class ') && !str.startsWith('function ')) return str;
          }
          if (typeof cal.displayDate === 'string') return cal.displayDate;
          if (typeof cal.display === 'string') return cal.display;
      }
      return "Calendaria Active";
    }
    const day = Math.floor(game.time.worldTime / 86400);
    return `Day ${day}`;
  }
  const c = (game.settings.get('intoterica', 'data') || {}).worldClock || { era: 1, day: 1 };
  return `Era ${c.era}, Day ${c.day}`;
}

/**
 * Prepares clock context.
 * @param {Object} settings 
 * @param {Object} perms 
 * @returns {{clockDisplay: string, canEditClock: boolean, worldClock: Object}}
 */
export function prepareClockContext(settings, perms) {
  const useWorldClock = game.settings.get('intoterica', 'useWorldClock');
  const clockDisplay = getGameDate();
  const canEditClock = perms.clock && !useWorldClock;
  const worldClock = settings.worldClock || { era: 4, day: 442 };

  return {
    clockDisplay,
    canEditClock,
    worldClock
  };
}

export const clockActions = {
  _getGameDate() {
    return getGameDate();
  },

  async _onEditClock(event) {
    event.preventDefault();
    const settings = game.settings.get('intoterica', 'data');
    const clock = settings.worldClock || { era: 1, day: 1 };

    createDialog({
      title: "Edit World Clock",
      content: `
        <form class="intoterica-form">
          <div class="form-section">
            <div class="form-section-title"><i class="fas fa-hourglass-half"></i> World Date</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Current Era</label>
                <input type="number" name="era" value="${clock.era}" min="1" />
              </div>
              <div class="form-group">
                <label>Current Day</label>
                <input type="number" name="day" value="${clock.day}" min="1" />
              </div>
            </div>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Date",
          callback: async (html) => {
            const { data: formData } = getFormData(html);
            settings.worldClock = {
              era: parseInt(formData.era),
              day: parseInt(formData.day)
            };
            await this._saveData(settings);
            this._broadcastUpdate();
            this.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, { width: 380 }).render(true);
  }
};

/**
 * Binds clock-related DOM events.
 * @param {JQuery} html 
 * @param {Object} app 
 */
export function bindClockEvents(html, app) {
  if (html && typeof html.render === 'function') {
    const tmp = html;
    html = app;
    app = tmp;
  }
  if (!html || !app) return;
  if (hasPermission('permClock')) {
    html.find('.edit-clock').click(app._onEditClock.bind(app));
  }
}

