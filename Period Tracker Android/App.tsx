import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Period = { id: number; start_date: string; end_date: string | null; total_days: number | null };
type ThemePreference = 'system' | 'light' | 'dark';
type Tab = 'overview' | 'calendar' | 'history' | 'settings';
type RangeDraft = { periodId?: number; start: string; end: string };

type CalendarDayInfo = {
  dateString: string;
  dayNumber: number;
  monthOffset: -1 | 0 | 1;
  isCurrentMonth: boolean;
  col: number;
  row: number;
};

const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); };
const today = formatDate(new Date());
const pretty = (value: string) => parseDate(value).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const days = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
const migrateDb = async (db: SQLiteDatabase) => db.execAsync(`CREATE TABLE IF NOT EXISTS periods (id INTEGER PRIMARY KEY AUTOINCREMENT, start_date TEXT NOT NULL, end_date TEXT, total_days INTEGER); CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`);
const average = (values: number[]) => values.length ? Math.ceil(values.reduce((a, b) => a + b, 0) / values.length) : null;

function buildMonthDays(month: Date): CalendarDayInfo[][] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const rows: CalendarDayInfo[][] = [];

  for (let r = 0; r < 6; r++) {
    const rowCells: CalendarDayInfo[] = [];
    for (let c = 0; c < 7; c++) {
      const i = r * 7 + c;
      let dateString = '';
      let dayNumber = 0;
      let monthOffset: -1 | 0 | 1 = 0;
      let isCurrentMonth = true;

      if (i < firstDayOfWeek) {
        dayNumber = daysInPrevMonth - firstDayOfWeek + 1 + i;
        monthOffset = -1;
        isCurrentMonth = false;
        dateString = formatDate(new Date(year, monthIndex - 1, dayNumber, 12));
      } else if (i < firstDayOfWeek + daysInMonth) {
        dayNumber = i - firstDayOfWeek + 1;
        monthOffset = 0;
        isCurrentMonth = true;
        dateString = formatDate(new Date(year, monthIndex, dayNumber, 12));
      } else {
        dayNumber = i - (firstDayOfWeek + daysInMonth) + 1;
        monthOffset = 1;
        isCurrentMonth = false;
        dateString = formatDate(new Date(year, monthIndex + 1, dayNumber, 12));
      }

      rowCells.push({
        dateString,
        dayNumber,
        monthOffset,
        isCurrentMonth,
        col: c,
        row: r,
      });
    }
    rows.push(rowCells);
  }

  return rows;
}

function TrackerContent() {
  const db = useSQLiteContext();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [filter, setFilter] = useState('All');
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarEditor, setCalendarEditor] = useState(false);
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const [rangeConfirmation, setRangeConfirmation] = useState<{ periodId?: number; start: string; end: string } | null>(null);
  const [rangeDraft, setRangeDraft] = useState<RangeDraft | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [displayName, setDisplayName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const systemColorScheme = useColorScheme();
  const isDark = themePreference === 'dark' || (themePreference === 'system' && systemColorScheme === 'dark');
  const s = useMemo(() => makeStyles(isDark), [isDark]);

  const refresh = useCallback(() => {
    try {
      setPeriods(db.getAllSync<Period>('SELECT id, start_date, end_date, total_days FROM periods ORDER BY start_date DESC, id DESC'));
    } catch (e) {
      console.error('Failed to load periods:', e);
    }
  }, [db]);

  useEffect(() => {
    try {
      const t = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'theme')?.value;
      if (t === 'system' || t === 'light' || t === 'dark') setThemePreference(t);
      const n = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'name')?.value ?? '';
      setDisplayName(n);
      setNameDraft(n);
      refresh();
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, [db, refresh]);

  const chronological = useMemo(() => [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id), [periods]);
  const nextPeriodById = useMemo(() => new Map(chronological.map((p, i) => [p.id, chronological[i + 1] ?? null])), [chronological]);
  const shown = useMemo(() => filter === 'All' ? periods : filter === 'Recent' ? periods.slice(0, 5) : periods.filter(p => p.start_date.startsWith(filter)), [periods, filter]);
  const years = useMemo(() => ['All', 'Recent', ...Array.from(new Set(periods.map(p => p.start_date.slice(0, 4))))], [periods]);
  const historicalPeriods = useMemo(() => periods.filter(p => p.end_date), [periods]);
  const historicalPeriodAverage = useMemo(() => average(historicalPeriods.map(p => p.total_days ?? days(p.start_date, p.end_date!) + 1)), [historicalPeriods]);
  const historicalCycleValues = useMemo(() => chronological.slice(0, -1).flatMap((p, i) => { const gap = days(p.start_date, chronological[i + 1].start_date); return gap <= 45 ? [gap - 1] : []; }), [chronological]);
  const historicalCycleAverage = useMemo(() => average(historicalCycleValues), [historicalCycleValues]);

  const recentChain: Period[] = useMemo(() => {
    const chain: Period[] = chronological.length ? [chronological[chronological.length - 1]] : [];
    for (let i = chronological.length - 2; i >= 0 && chain.length < 7; i--) {
      if (days(chronological[i].start_date, chronological[i + 1].start_date) > 45) break;
      chain.unshift(chronological[i]);
    }
    return chain;
  }, [chronological]);

  const recentPeriodAverage = useMemo(() => average(recentChain.filter(p => p.end_date).map(p => p.total_days ?? days(p.start_date, p.end_date!) + 1)), [recentChain]);
  const recentCycleValues = useMemo(() => recentChain.slice(0, -1).map((p, i) => days(p.start_date, recentChain[i + 1].start_date) - 1), [recentChain]);
  const recentCycleAverage = useMemo(() => average(recentCycleValues), [recentCycleValues]);

  const save = () => {
    if (end && end < start) return Alert.alert('Check your dates', 'The end date must be on or after the start date.');
    const total = end ? days(start, end) + 1 : null;
    if (editing !== null) db.runSync('UPDATE periods SET start_date = ?, end_date = ?, total_days = ? WHERE id = ?', start, end || null, total, editing);
    else db.runSync('INSERT INTO periods (start_date, end_date, total_days) VALUES (?, ?, ?)', start, end || null, total);
    setEditing(null);
    setEnd('');
    setCalendarEditor(false);
    refresh();
  };

  const onDateValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    if (picker === 'start') setStart(formatDate(selectedDate));
    if (picker === 'end') setEnd(formatDate(selectedDate));
    if (Platform.OS === 'android') setPicker(null);
  };

  const chooseTheme = (value: ThemePreference) => {
    db.runSync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'theme', value);
    setThemePreference(value);
  };

  const saveName = () => {
    const value = nameDraft.trim();
    db.runSync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'name', value);
    setDisplayName(value);
    setNameDraft(value);
    Keyboard.dismiss();
    if (Platform.OS === 'android') ToastAndroid.show('Name saved', ToastAndroid.SHORT);
  };

  const edit = (p: Period) => {
    setStart(p.start_date);
    setEnd(p.end_date || '');
    setEditing(p.id);
    setTab('calendar');
    setCalendarMonth(new Date(parseDate(p.start_date).getFullYear(), parseDate(p.start_date).getMonth(), 1));
    setCalendarEditor(true);
  };

  const remove = (id: number) => {
    Alert.alert('Delete this record?', 'This period will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { db.runSync('DELETE FROM periods WHERE id = ?', id); refresh(); } },
    ]);
  };

  const pickCalendarDate = useCallback((date: string) => {
    if (date > today) return Alert.alert('Check your dates', 'A period start date cannot be in the future.');
    if (periods.some(p => date >= p.start_date && date <= (p.end_date ?? p.start_date))) {
      return;
    }
    setConfirmDate(date);
  }, [periods]);

  const confirmCycleStart = () => {
    if (!confirmDate) return;
    db.runSync('INSERT INTO periods (start_date, end_date, total_days) VALUES (?, ?, ?)', confirmDate, null, null);
    setConfirmDate(null);
    refresh();
  };

  const saveCalendarRange = useCallback((periodId: number | undefined, startDate: string, endDate: string) => {
    if (endDate < startDate) return;
    const total = days(startDate, endDate) + 1;
    if (periodId != null) {
      db.runSync('UPDATE periods SET start_date = ?, end_date = ?, total_days = ? WHERE id = ?', startDate, endDate, total, periodId);
    } else {
      db.runSync('INSERT INTO periods (start_date, end_date, total_days) VALUES (?, ?, ?)', startDate, endDate, total);
    }
    setRangeConfirmation(null);
    setRangeDraft(null);
    refresh();
  }, [db, refresh]);

  const requestRangeSave = useCallback((periodId: number | undefined, startDate: string, endDate: string) => {
    setRangeConfirmation({ periodId, start: startDate, end: endDate });
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={s.top}>
        <View>
          <Text style={s.eyebrow}>YOUR PRIVATE CYCLE JOURNAL</Text>
          <Text style={s.brand}>Period Tracker</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Settings" style={s.settingsButton} onPress={() => setTab('settings')}>
          <Text style={s.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>
      <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {tab === 'overview' && (
          <>
            <Text style={s.greeting}>{displayName ? `Hi, ${displayName}` : 'Overview'}</Text>
            <Text style={s.sub}>A clear view of your cycle patterns.</Text>
            <Text style={s.section}>Recent</Text>
            <Text style={s.helper}>Up to 6 latest consecutive cycles, ending at the latest record.</Text>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statIcon}>🩸</Text>
                <Text style={s.statNum}>{recentPeriodAverage ? `${recentPeriodAverage} days` : '—'}</Text>
                <Text style={s.statLabel}>AVG. PERIOD</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statIcon}>☀️</Text>
                <Text style={s.statNum}>{recentCycleAverage ? `${recentCycleAverage} days` : '—'}</Text>
                <Text style={s.statLabel}>AVG. CYCLE</Text>
              </View>
            </View>
            <Text style={s.section}>Historical</Text>
            <Text style={s.helper}>Based on every record in your database.</Text>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statIcon}>🩸</Text>
                <Text style={s.statNum}>{historicalPeriodAverage ? `${historicalPeriodAverage} days` : '—'}</Text>
                <Text style={s.statLabel}>AVG. PERIOD</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statIcon}>☀️</Text>
                <Text style={s.statNum}>{historicalCycleAverage ? `${historicalCycleAverage} days` : '—'}</Text>
                <Text style={s.statLabel}>AVG. CYCLE</Text>
              </View>
            </View>
            <View style={s.callout}>
              <Text style={s.calloutTitle}>Your records stay on this device</Text>
              <Text style={s.calloutText}>Tap Calendar to browse dates or add a period.</Text>
            </View>
          </>
        )}
        {tab === 'calendar' && (
          <>
            <Text style={s.greeting}>Calendar</Text>
            <Text style={s.sub}>Your saved period dates at a glance.</Text>
            <CalendarGrid
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              periods={periods}
              selected={calendarEditor ? start : ''}
              rangeDraft={rangeDraft}
              onRangeDraftChange={setRangeDraft}
              s={s}
              isDark={isDark}
              onPick={pickCalendarDate}
              onRangeEnd={requestRangeSave}
              setIsScrollingAllowed={setScrollEnabled}
            />
            <View style={s.legend}>
              <Text style={s.drop}>🩸</Text>
              <Text style={s.helper}>Period dates</Text>
            </View>
            <Text style={s.gestureHelp}>Tap an available date to log a period start. Drag from start to end date to save the full period record.</Text>
            {calendarEditor && (
              <View style={s.card}>
                <Text style={s.section}>{editing !== null ? 'Edit period' : 'New period'}</Text>
                <Text style={s.label}>START DATE</Text>
                <TouchableOpacity style={s.dateButton} onPress={() => setPicker('start')}>
                  <Text style={s.dateText}>📅  {pretty(start)}</Text>
                  <Text style={s.dateHint}>Change</Text>
                </TouchableOpacity>
                <Text style={s.label}>END DATE <Text style={s.optional}>· OPTIONAL</Text></Text>
                <TouchableOpacity style={s.dateButton} onPress={() => setPicker('end')}>
                  <Text style={[s.dateText, !end && s.datePlaceholder]}>{end ? `📅  ${pretty(end)}` : 'Choose an end date'}</Text>
                  {end ? (
                    <TouchableOpacity onPress={() => setEnd('')}>
                      <Text style={s.clearDate}>Clear</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.dateHint}>Optional</Text>
                  )}
                </TouchableOpacity>
                {picker && (
                  <DateTimePicker
                    value={picker === 'start' ? parseDate(start) : end ? parseDate(end) : parseDate(start)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    minimumDate={picker === 'end' ? parseDate(start) : undefined}
                    themeVariant={isDark ? 'dark' : 'light'}
                    onValueChange={onDateValueChange}
                    onDismiss={() => Platform.OS === 'android' && setPicker(null)}
                  />
                )}
                {picker && Platform.OS === 'ios' && (
                  <TouchableOpacity style={s.pickerDone} onPress={() => setPicker(null)}>
                    <Text style={s.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.button} onPress={save}>
                  <Text style={s.buttonText}>{editing !== null ? 'Save changes' : 'Save period'}  →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setCalendarEditor(false); setEditing(null); }}>
                  <Text style={s.cancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        {tab === 'history' && (
          <>
            <Text style={s.greeting}>Your history</Text>
            <Text style={s.sub}>All the notes you’ve logged, in one place.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[s.chip, filter === y && s.chipOn]} onPress={() => setFilter(y)}>
                  <Text style={[s.chipText, filter === y && s.chipTextOn]}>{y === 'Recent' ? 'Recent 5' : y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.historyStats}>
              <Text style={s.historyCount}>{shown.length}</Text>
              <Text style={s.historyLabel}>{filter === 'All' ? 'TOTAL RECORDS' : filter === 'Recent' ? 'MOST RECENT' : `STARTED IN ${filter}`}</Text>
            </View>
            {shown.map(p => (
              <PeriodCard key={p.id} p={p} nextPeriod={nextPeriodById.get(p.id) ?? null} s={s} onEdit={edit} onDelete={remove} />
            ))}
            {!shown.length && <Text style={s.empty}>No periods to show yet. Start by tapping a date in Calendar.</Text>}
            <View style={s.note}>
              <Text style={s.noteTitle}>A note about your averages</Text>
              <Text style={s.noteText}>Average period length uses completed records. Cycle length counts through the day before the next start. Intervals longer than 45 days are shown as gaps and excluded from cycle averages.</Text>
            </View>
          </>
        )}
        {tab === 'settings' && (
          <>
            <Text style={s.greeting}>Settings</Text>
            <Text style={s.sub}>Make your tracker feel like yours.</Text>
            <View style={s.card}>
              <Text style={s.section}>Your name</Text>
              <Text style={s.appearanceHelp}>Add a name for your personal welcome.</Text>
              <TextInput
                accessibilityLabel="Your name"
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Enter your name"
                placeholderTextColor={isDark ? '#a99591' : '#b4a8a6'}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={saveName}
                style={s.nameInput}
              />
              <TouchableOpacity style={s.button} onPress={saveName}>
                <Text style={s.buttonText}>Save name</Text>
              </TouchableOpacity>
            </View>
            <View style={s.appearance}>
              <Text style={s.appearanceTitle}>Appearance</Text>
              <Text style={s.appearanceHelp}>Choose a theme or follow your device setting.</Text>
              <View style={s.appearanceOptions}>
                {(['system', 'light', 'dark'] as const).map(option => (
                  <TouchableOpacity
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: themePreference === option }}
                    style={[s.appearanceOption, themePreference === option && s.appearanceSelected]}
                    onPress={() => chooseTheme(option)}
                  >
                    <Text style={[s.appearanceText, themePreference === option && s.appearanceSelectedText]}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <Modal visible={confirmDate !== null} transparent animationType="fade" onRequestClose={() => setConfirmDate(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.confirmModal}>
            <Text style={s.confirmTitle}>First day of cycle?</Text>
            <Text style={s.confirmDate}>{confirmDate ? pretty(confirmDate) : ''}</Text>
            <Text style={s.confirmHelp}>Save this date as the start of a new period?</Text>
            <View style={s.confirmActions}>
              <TouchableOpacity accessibilityRole="button" style={s.modalCancel} onPress={() => setConfirmDate(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={s.modalConfirm} onPress={confirmCycleStart}>
                <Text style={s.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={rangeConfirmation !== null} transparent animationType="fade" onRequestClose={() => { setRangeConfirmation(null); setRangeDraft(null); }}>
        <View style={s.modalBackdrop}>
          <View style={s.confirmModal}>
            <Text style={s.confirmTitle}>Save period record?</Text>
            <Text style={s.confirmHelp}>Start date: <Text style={s.confirmDate}>{rangeConfirmation ? pretty(rangeConfirmation.start) : ''}</Text></Text>
            <Text style={s.confirmHelp}>End date: <Text style={s.confirmDate}>{rangeConfirmation ? pretty(rangeConfirmation.end) : ''}</Text></Text>
            {rangeConfirmation && (
              <Text style={s.confirmHelp}>
                Duration: <Text style={s.confirmDate}>{days(rangeConfirmation.start, rangeConfirmation.end) + 1} days</Text>
              </Text>
            )}
            <View style={s.confirmActions}>
              <TouchableOpacity accessibilityRole="button" style={s.modalCancel} onPress={() => { setRangeConfirmation(null); setRangeDraft(null); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={s.modalConfirm}
                onPress={() => rangeConfirmation && saveCalendarRange(rangeConfirmation.periodId, rangeConfirmation.start, rangeConfirmation.end)}
              >
                <Text style={s.modalConfirmText}>Save record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={s.nav}>
        {(['overview', 'calendar', 'history'] as const).map((t, i) => (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => setTab(t)}>
            <Text style={[s.navIcon, tab === t && s.active]}>{['⌂', '▦', '▤'][i]}</Text>
            <Text style={[s.navText, tab === t && s.active]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="period-tracker.db" onInit={migrateDb} useSuspense>
          <TrackerContent />
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

type CalendarGridProps = {
  month: Date;
  onMonthChange: (month: Date | ((prev: Date) => Date)) => void;
  periods: Period[];
  selected: string;
  rangeDraft: RangeDraft | null;
  onRangeDraftChange: (draft: RangeDraft | null) => void;
  s: ReturnType<typeof makeStyles>;
  isDark: boolean;
  onPick: (date: string) => void;
  onRangeEnd: (periodId: number | undefined, start: string, end: string) => void;
  setIsScrollingAllowed: (allowed: boolean) => void;
};

const ROW_HEIGHT = 52;

function CalendarGrid({
  month,
  onMonthChange,
  periods,
  selected,
  rangeDraft,
  onRangeDraftChange,
  s,
  isDark: _isDark,
  onPick,
  onRangeEnd,
  setIsScrollingAllowed,
}: CalendarGridProps) {
  const [gridWidth, setGridWidth] = useState(0);
  const gridWidthRef = useRef(0);
  gridWidthRef.current = gridWidth;
  const gridOriginRef = useRef({ x: 0, y: 0 });

  const rows = useMemo(() => buildMonthDays(month), [month]);
  const flatCells = useMemo(() => rows.flat(), [rows]);

  const isViewingCurrentMonth = useMemo(() => {
    const now = new Date();
    return month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  }, [month]);

  const monthTitle = useMemo(() => {
    return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [month]);

  const goToPrevMonth = useCallback(() => {
    onMonthChange(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, [onMonthChange]);

  const goToNextMonth = useCallback(() => {
    onMonthChange(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, [onMonthChange]);

  const goToToday = useCallback(() => {
    onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }, [onMonthChange]);

  const periodsRef = useRef(periods);
  periodsRef.current = periods;

  const rangeDraftRef = useRef(rangeDraft);
  rangeDraftRef.current = rangeDraft;

  const touchInfoRef = useRef<{
    startX: number;
    startY: number;
    startPageX: number;
    startPageY: number;
    startDate: string;
    periodId?: number;
    isOtherMonth: boolean;
    monthOffset: -1 | 0 | 1;
  } | null>(null);

  const isDraggingRef = useRef(false);

  const getCellFromLocation = useCallback((x: number, y: number): CalendarDayInfo | null => {
    const width = gridWidthRef.current || 350;
    const colWidth = width / 7;
    const col = Math.min(6, Math.max(0, Math.floor(x / colWidth)));
    const row = Math.min(5, Math.max(0, Math.floor(y / ROW_HEIGHT)));
    const index = row * 7 + col;
    return flatCells[index] ?? null;
  }, [flatCells]);

  const isDateDisabled = useCallback((dateString: string): boolean => {
    if (dateString > today) return true;
    const period = periodsRef.current.find(p => dateString >= p.start_date && dateString <= (p.end_date ?? p.start_date));
    if (period && period.end_date !== null) {
      return true;
    }
    return false;
  }, []);

  const clampRange = useCallback((startDate: string, hoverDate: string, excludePeriodId?: number) => {
    let low = startDate < hoverDate ? startDate : hoverDate;
    let high = startDate < hoverDate ? hoverDate : startDate;

    if (high > today) high = today;

    const currentPeriods = periodsRef.current.filter(p => p.id !== excludePeriodId);

    if (hoverDate >= startDate) {
      const nextPeriod = currentPeriods
        .filter(p => p.start_date > startDate)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
      if (nextPeriod && high >= nextPeriod.start_date) {
        const maxHigh = formatDate(new Date(parseDate(nextPeriod.start_date).getTime() - 86400000));
        high = maxHigh < startDate ? startDate : maxHigh;
      }
    }

    if (hoverDate <= startDate) {
      const prevPeriod = currentPeriods
        .filter(p => (p.end_date ?? p.start_date) < startDate)
        .sort((a, b) => (b.end_date ?? b.start_date).localeCompare(a.end_date ?? a.start_date))[0];
      if (prevPeriod) {
        const prevEnd = prevPeriod.end_date ?? prevPeriod.start_date;
        if (low <= prevEnd) {
          const minLow = formatDate(new Date(parseDate(prevEnd).getTime() + 86400000));
          low = minLow > startDate ? startDate : minLow;
        }
      }
    }

    return { start: low, end: high };
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const cell = getCellFromLocation(locationX, locationY);
      if (!cell) return false;
      if (isDateDisabled(cell.dateString)) {
        return false;
      }
      return true;
    },

    onStartShouldSetPanResponderCapture: () => false,

    onMoveShouldSetPanResponder: (_evt, gestureState) => {
      return Math.hypot(gestureState.dx, gestureState.dy) > 6;
    },

    onPanResponderGrant: (evt) => {
      const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
      gridOriginRef.current = { x: pageX - locationX, y: pageY - locationY };

      const cell = getCellFromLocation(locationX, locationY);
      if (!cell || isDateDisabled(cell.dateString)) return;

      const ongoing = periodsRef.current.find(p => p.start_date === cell.dateString && p.end_date === null);

      touchInfoRef.current = {
        startX: locationX,
        startY: locationY,
        startPageX: pageX,
        startPageY: pageY,
        startDate: cell.dateString,
        periodId: ongoing?.id,
        isOtherMonth: !cell.isCurrentMonth,
        monthOffset: cell.monthOffset,
      };

      isDraggingRef.current = false;
      setIsScrollingAllowed(false);
    },

    onPanResponderMove: (evt) => {
      const info = touchInfoRef.current;
      if (!info) return;

      const dx = evt.nativeEvent.pageX - info.startPageX;
      const dy = evt.nativeEvent.pageY - info.startPageY;
      const distance = Math.hypot(dx, dy);

      if (!isDraggingRef.current) {
        if (distance > 8 && !info.isOtherMonth) {
          isDraggingRef.current = true;
        } else {
          return;
        }
      }

      const currentX = evt.nativeEvent.pageX - gridOriginRef.current.x;
      const currentY = evt.nativeEvent.pageY - gridOriginRef.current.y;
      const cell = getCellFromLocation(currentX, currentY);
      if (cell) {
        const clamped = clampRange(info.startDate, cell.dateString, info.periodId);
        onRangeDraftChange({
          periodId: info.periodId,
          start: clamped.start,
          end: clamped.end,
        });
      }
    },

    onPanResponderRelease: () => {
      setIsScrollingAllowed(true);
      const info = touchInfoRef.current;
      const wasDragging = isDraggingRef.current;
      touchInfoRef.current = null;
      isDraggingRef.current = false;

      if (!info) return;

      if (wasDragging) {
        const draft = rangeDraftRef.current;
        if (draft && draft.start !== draft.end) {
          onRangeEnd(draft.periodId, draft.start, draft.end);
        } else {
          onRangeDraftChange(null);
          if (draft) {
            onPick(draft.start);
          }
        }
      } else {
        onRangeDraftChange(null);
        if (info.isOtherMonth) {
          if (info.monthOffset === -1) goToPrevMonth();
          else if (info.monthOffset === 1) goToNextMonth();
        } else {
          onPick(info.startDate);
        }
      }
    },

    onPanResponderTerminate: () => {
      setIsScrollingAllowed(true);
      touchInfoRef.current = null;
      isDraggingRef.current = false;
      onRangeDraftChange(null);
    },

    onPanResponderTerminationRequest: () => false,
  }), [getCellFromLocation, isDateDisabled, clampRange, onRangeDraftChange, onRangeEnd, onPick, setIsScrollingAllowed, goToPrevMonth, goToNextMonth]);

  return (
    <View style={s.calendar}>
      <View style={s.monthHeader}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.monthArrow}
          onPress={goToPrevMonth}
        >
          <Text style={s.monthArrowText}>‹</Text>
        </TouchableOpacity>
        <View style={s.monthTitleContainer}>
          <Text style={s.monthTitle}>{monthTitle}</Text>
          {!isViewingCurrentMonth && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go to current month" style={s.todayChip} onPress={goToToday}>
              <Text style={s.todayChipText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.monthArrow}
          onPress={goToNextMonth}
        >
          <Text style={s.monthArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={s.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={`${d}-${i}`} style={s.weekDay}>{d}</Text>
        ))}
      </View>

      <View
        style={s.daysGrid}
        onLayout={e => {
          setGridWidth(e.nativeEvent.layout.width);
        }}
        {...panResponder.panHandlers}
      >
        {rows.map((rowCells, r) => (
          <View key={`row-${r}`} style={s.gridRow}>
            {rowCells.map(cell => {
              const period = periods.find(p => cell.dateString >= p.start_date && cell.dateString <= (p.end_date ?? p.start_date));
              const isInPeriod = Boolean(period);
              const isPeriodStart = period ? cell.dateString === period.start_date : false;
              const isPeriodEnd = period ? cell.dateString === (period.end_date ?? period.start_date) : false;
              const isSingleDay = period ? period.start_date === (period.end_date ?? period.start_date) : false;

              const isInDraft = Boolean(rangeDraft && cell.dateString >= rangeDraft.start && cell.dateString <= rangeDraft.end);
              const isDraftStart = rangeDraft ? cell.dateString === rangeDraft.start : false;
              const isDraftEnd = rangeDraft ? cell.dateString === rangeDraft.end : false;
              const isDraftSingle = rangeDraft ? rangeDraft.start === rangeDraft.end : false;

              const isToday = cell.dateString === today;
              const isSelected = selected === cell.dateString;
              const isFuture = cell.dateString > today;

              let rangeBarComponent = null;
              if (isInPeriod) {
                let capStyle: StyleProp<ViewStyle> = s.rangeBarMiddle;
                if (isSingleDay) capStyle = s.rangeSingle;
                else if (isPeriodStart) capStyle = cell.col === 6 ? s.rangeSingle : s.rangeCapLeft;
                else if (isPeriodEnd) capStyle = cell.col === 0 ? s.rangeSingle : s.rangeCapRight;
                else if (cell.col === 0) capStyle = s.rangeCapLeft;
                else if (cell.col === 6) capStyle = s.rangeCapRight;

                rangeBarComponent = <View pointerEvents="none" style={[s.rangeBar, s.rangeBarPeriod, capStyle]} />;
              } else if (isInDraft) {
                let capStyle: StyleProp<ViewStyle> = s.rangeBarMiddle;
                if (isDraftSingle) capStyle = s.rangeSingle;
                else if (isDraftStart) capStyle = cell.col === 6 ? s.rangeSingle : s.rangeCapLeft;
                else if (isDraftEnd) capStyle = cell.col === 0 ? s.rangeSingle : s.rangeCapRight;
                else if (cell.col === 0) capStyle = s.rangeCapLeft;
                else if (cell.col === 6) capStyle = s.rangeCapRight;

                rangeBarComponent = <View pointerEvents="none" style={[s.rangeBar, s.rangeBarDraft, capStyle]} />;
              }

              return (
                <View key={cell.dateString} style={s.gridCell} pointerEvents="none">
                  {rangeBarComponent}
                  <View style={[s.cellInner, isSelected && s.cellSelected]}>
                    <Text
                      style={[
                        s.dayNumber,
                        !cell.isCurrentMonth && s.dayNumberOtherMonth,
                        isToday && cell.isCurrentMonth && s.dayNumberToday,
                        isInPeriod && s.dayNumberPeriod,
                        isInDraft && s.dayNumberDraft,
                        isFuture && !isInPeriod && s.dayNumberFuture,
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>
                    {(isInPeriod || isInDraft) && (
                      <Text style={s.dayDrop}>🩸</Text>
                    )}
                    {!isInPeriod && !isInDraft && isToday && (
                      <View style={s.todayDot} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function PeriodCard({ p, nextPeriod, s, onEdit, onDelete }: { p: Period; nextPeriod: Period | null; s: ReturnType<typeof makeStyles>; onEdit: (p: Period) => void; onDelete: (id: number) => void }) {
  const gap = nextPeriod ? days(p.start_date, nextPeriod.start_date) : null;
  const cycleText = !p.end_date || gap === null ? 'Ongoing or N/A' : gap > 45 ? `>45 days gap in records (${gap - 1} days)` : `${gap - 1} days cycle length`;
  return (
    <View style={s.period}>
      <View style={s.periodIcon}>
        <Text style={{ fontSize: 18 }}>🩸</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.periodDate}>{pretty(p.start_date)} – {p.end_date ? pretty(p.end_date) : 'Ongoing'}</Text>
        <Text style={s.periodMeta}>{p.total_days !== null ? `${p.total_days} days` : 'In progress'}</Text>
        <Text style={[s.periodGap, gap !== null && gap > 45 && s.periodGapWarning]}>{cycleText}</Text>
      </View>
      <TouchableOpacity style={s.action} onPress={() => onEdit(p)}>
        <Text style={s.actionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.trash} onPress={() => onDelete(p.id)}>
        <Text style={s.trashText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (dark: boolean) => {
  const base = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff8f6' },
    top: { height: 66, paddingHorizontal: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingsButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f5e6e1', alignItems: 'center', justifyContent: 'center' },
    settingsIcon: { color: '#660000', fontSize: 22 },
    eyebrow: { fontSize: 9, letterSpacing: 1.7, color: '#a18d88', fontWeight: '700' },
    brand: { fontSize: 25, fontWeight: '800', letterSpacing: -0.7, color: '#563f3d' },
    content: { paddingHorizontal: 21, paddingBottom: 26 },
    greeting: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5, color: '#483735', marginTop: 12 },
    sub: { fontSize: 13, color: '#968582', marginTop: 5, marginBottom: 13 },
    helper: { fontSize: 11, color: '#968582', marginTop: -7, marginBottom: 10 },
    section: { fontSize: 17, fontWeight: '700', color: '#503d3a', marginTop: 18, marginBottom: 12 },
    stats: { flexDirection: 'row', gap: 11, marginTop: 2 },
    stat: { flex: 1, backgroundColor: '#fff', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#f2e8e5' },
    statIcon: { fontSize: 18 },
    statNum: { fontSize: 20, fontWeight: '700', color: '#563f3d', marginTop: 7 },
    statLabel: { fontSize: 9, letterSpacing: 1, color: '#a18d88', marginTop: 5, fontWeight: '700' },
    callout: { backgroundColor: '#f5eae7', borderRadius: 16, padding: 16, marginTop: 22 },
    calloutTitle: { fontSize: 13, fontWeight: '700', color: '#704e49' },
    calloutText: { fontSize: 11, color: '#907a75', marginTop: 5 },
    nav: { height: 64, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1e8e5', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
    navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
    navIcon: { fontSize: 21, color: '#b8a7a2' },
    navText: { fontSize: 10, color: '#ad9c97', marginTop: 1 },
    active: { color: '#660000', fontWeight: '700' },
    monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
    monthTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monthTitle: { fontSize: 17, fontWeight: '700', color: '#503d3a' },
    todayChip: { backgroundColor: '#f5eae7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    todayChipText: { fontSize: 11, fontWeight: '700', color: '#660000' },
    monthArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5eae7', alignItems: 'center', justifyContent: 'center' },
    monthArrowText: { fontSize: 24, fontWeight: '600', color: '#660000', lineHeight: 26 },
    calendar: { backgroundColor: '#fff', borderRadius: 19, padding: 12, borderWidth: 1, borderColor: '#f2e8e5' },
    weekRow: { flexDirection: 'row', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f7eeeb', paddingBottom: 6 },
    weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#a18d88' },
    daysGrid: { width: '100%' },
    gridRow: { flexDirection: 'row', height: ROW_HEIGHT, alignItems: 'center' },
    gridCell: { flex: 1, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    rangeBar: { position: 'absolute', top: 5, bottom: 5 },
    rangeBarPeriod: { backgroundColor: '#fadcd7' },
    rangeBarDraft: { backgroundColor: '#fcd2cb', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#660000' },
    rangeCapLeft: { left: 3, right: 0, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
    rangeCapRight: { left: 0, right: 3, borderTopRightRadius: 18, borderBottomRightRadius: 18 },
    rangeBarMiddle: { left: 0, right: 0, borderRadius: 0 },
    rangeSingle: { left: 3, right: 3, borderRadius: 18 },
    cellInner: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    cellSelected: { borderWidth: 1.5, borderColor: '#660000' },
    dayNumber: { fontSize: 14, fontWeight: '600', color: '#503d3a' },
    dayNumberOtherMonth: { color: '#c9b8b4', fontWeight: '400' },
    dayNumberToday: { color: '#660000', fontWeight: '800' },
    dayNumberPeriod: { color: '#502020', fontWeight: '700' },
    dayNumberDraft: { color: '#660000', fontWeight: '700' },
    dayNumberFuture: { color: '#d5c8c5' },
    dayDrop: { fontSize: 11, marginTop: 1 },
    todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#660000', marginTop: 2 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 7 },
    drop: { fontSize: 15 },
    gestureHelp: { fontSize: 11, lineHeight: 16, color: '#968582', marginTop: 3, marginBottom: 10 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 17, marginTop: 13, borderWidth: 1, borderColor: '#f2e8e5' },
    label: { fontSize: 9, letterSpacing: 1.3, fontWeight: '700', color: '#9b8580', marginTop: 10, marginBottom: 7 },
    optional: { color: '#c5b4b0', fontWeight: '500' },
    dateButton: { height: 47, borderRadius: 12, backgroundColor: '#fcf7f5', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f1e8e5' },
    dateText: { color: '#503d3a', fontSize: 14 },
    datePlaceholder: { color: '#b4a8a6' },
    dateHint: { fontSize: 11, color: '#aa8984' },
    clearDate: { fontSize: 11, color: '#660000', fontWeight: '600' },
    pickerDone: { alignSelf: 'flex-end', padding: 10 },
    pickerDoneText: { color: '#660000', fontWeight: '700' },
    button: { backgroundColor: '#660000', height: 49, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    cancel: { textAlign: 'center', marginTop: 12, color: '#660000', fontSize: 12 },
    filters: { flexGrow: 0, marginBottom: 13 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#f5eae7', marginRight: 8 },
    chipOn: { backgroundColor: '#660000' },
    chipText: { fontSize: 11, color: '#8d7772' },
    chipTextOn: { color: '#fff', fontWeight: '700' },
    historyStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 8 },
    historyCount: { fontSize: 22, fontWeight: '700', color: '#563f3d' },
    historyLabel: { fontSize: 9, letterSpacing: 1, color: '#a18d88', fontWeight: '700' },
    period: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 15, marginBottom: 9, borderWidth: 1, borderColor: '#f3eae7' },
    periodIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#f8eeeb', alignItems: 'center', justifyContent: 'center' },
    periodDate: { fontSize: 12, fontWeight: '600', color: '#594541' },
    periodMeta: { fontSize: 11, color: '#a08d87', marginTop: 4 },
    periodGap: { fontSize: 10, color: '#a08d87', marginTop: 3 },
    periodGapWarning: { color: '#660000', fontWeight: '700' },
    action: { padding: 6 },
    actionText: { fontSize: 11, color: '#660000', fontWeight: '600' },
    trash: { width: 25, height: 28, alignItems: 'center', justifyContent: 'center' },
    trashText: { color: '#aa8987', fontSize: 18 },
    empty: { color: '#a08d87', fontSize: 12, paddingVertical: 12 },
    note: { backgroundColor: '#f5eae7', padding: 15, borderRadius: 15, marginTop: 15 },
    noteTitle: { fontSize: 12, fontWeight: '700', color: '#704e49' },
    noteText: { fontSize: 11, lineHeight: 17, color: '#907a75', marginTop: 6 },
    nameInput: { height: 47, marginTop: 12, borderRadius: 12, backgroundColor: '#fcf7f5', paddingHorizontal: 13, color: '#503d3a', fontSize: 14, borderWidth: 1, borderColor: '#f1e8e5' },
    appearance: { backgroundColor: '#fff', borderRadius: 17, padding: 15, marginTop: 18, borderWidth: 1, borderColor: '#f2e8e5' },
    appearanceTitle: { fontSize: 14, fontWeight: '700', color: '#503d3a' },
    appearanceHelp: { fontSize: 11, color: '#968582', marginTop: 4 },
    appearanceOptions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    appearanceOption: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: '#fcf7f5' },
    appearanceSelected: { backgroundColor: '#660000' },
    appearanceText: { fontSize: 11, color: '#8d7772', fontWeight: '600' },
    appearanceSelectedText: { color: '#fff' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(25,12,12,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    confirmModal: { width: '100%', maxWidth: 360, backgroundColor: '#fff8f6', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#f2e8e5' },
    confirmTitle: { fontSize: 21, fontWeight: '800', color: '#503d3a' },
    confirmDate: { fontSize: 15, fontWeight: '700', color: '#660000', marginTop: 10 },
    confirmHelp: { fontSize: 13, lineHeight: 19, color: '#8d7772', marginTop: 9 },
    confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
    modalCancel: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: '#f5eae7' },
    modalCancelText: { fontSize: 13, fontWeight: '700', color: '#704e49' },
    modalConfirm: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#660000' },
    modalConfirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });

  if (!dark) return base;
  const bg = (x: any) => ({ ...x, backgroundColor: '#241d20', borderColor: '#3a2e32' });
  const txt = (x: any) => ({ ...x, color: '#f0e4e2' });
  return {
    ...base,
    safe: { ...base.safe, backgroundColor: '#171315' },
    brand: txt(base.brand),
    greeting: txt(base.greeting),
    sub: { ...base.sub, color: '#bdaaa6' },
    helper: { ...base.helper, color: '#b6a19d' },
    gestureHelp: { ...base.gestureHelp, color: '#b6a19d' },
    section: txt(base.section),
    stat: bg(base.stat),
    statNum: txt(base.statNum),
    statLabel: { ...base.statLabel, color: '#ad9994' },
    callout: { ...base.callout, backgroundColor: '#34272a' },
    calloutTitle: txt(base.calloutTitle),
    calloutText: { ...base.calloutText, color: '#c5aeaa' },
    nav: { ...base.nav, backgroundColor: '#211a1d', borderTopColor: '#3a2e32' },
    navIcon: { ...base.navIcon, color: '#9f8985' },
    navText: { ...base.navText, color: '#a99591' },
    active: { ...base.active, color: '#ffb3b3' },
    monthHeader: base.monthHeader,
    monthTitleContainer: base.monthTitleContainer,
    monthTitle: txt(base.monthTitle),
    todayChip: { backgroundColor: '#34272a' },
    todayChipText: { color: '#ffb3b3' },
    monthArrow: { ...base.monthArrow, backgroundColor: '#34272a' },
    monthArrowText: { ...base.monthArrowText, color: '#ffb3b3' },
    calendar: bg(base.calendar),
    weekRow: { ...base.weekRow, borderBottomColor: '#34272a' },
    weekDay: { ...base.weekDay, color: '#ad9994' },
    daysGrid: base.daysGrid,
    gridRow: base.gridRow,
    gridCell: base.gridCell,
    rangeBar: base.rangeBar,
    rangeBarPeriod: { backgroundColor: '#482428' },
    rangeBarDraft: { backgroundColor: '#5c2d33', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ffb3b3' },
    rangeCapLeft: base.rangeCapLeft,
    rangeCapRight: base.rangeCapRight,
    rangeBarMiddle: base.rangeBarMiddle,
    rangeSingle: base.rangeSingle,
    cellInner: base.cellInner,
    cellSelected: { borderWidth: 1.5, borderColor: '#ffb3b3' },
    dayNumber: txt(base.dayNumber),
    dayNumberOtherMonth: { color: '#68565a', fontWeight: '400' },
    dayNumberToday: { color: '#ffb3b3', fontWeight: '800' },
    dayNumberPeriod: { color: '#ffd6d6', fontWeight: '700' },
    dayNumberDraft: { color: '#ffb3b3', fontWeight: '700' },
    dayNumberFuture: { color: '#544649' },
    dayDrop: base.dayDrop,
    todayDot: { ...base.todayDot, backgroundColor: '#ffb3b3' },
    card: bg(base.card),
    label: { ...base.label, color: '#c2aaa6' },
    optional: { ...base.optional, color: '#9f8985' },
    dateButton: { ...base.dateButton, backgroundColor: '#1c1719', borderColor: '#403337' },
    dateText: txt(base.dateText),
    datePlaceholder: { ...base.datePlaceholder, color: '#a99591' },
    dateHint: { ...base.dateHint, color: '#bba09c' },
    clearDate: { ...base.clearDate, color: '#ffb3b3' },
    pickerDoneText: { ...base.pickerDoneText, color: '#ffb3b3' },
    cancel: { ...base.cancel, color: '#ffb3b3' },
    chip: { ...base.chip, backgroundColor: '#34272a' },
    chipOn: { ...base.chipOn, backgroundColor: '#660000' },
    chipText: { ...base.chipText, color: '#c5aeaa' },
    historyCount: txt(base.historyCount),
    historyLabel: { ...base.historyLabel, color: '#ad9994' },
    period: bg(base.period),
    periodIcon: { ...base.periodIcon, backgroundColor: '#34272a' },
    periodDate: txt(base.periodDate),
    periodMeta: { ...base.periodMeta, color: '#b6a19d' },
    periodGap: { ...base.periodGap, color: '#b6a19d' },
    periodGapWarning: { ...base.periodGapWarning, color: '#ffb3b3' },
    actionText: { ...base.actionText, color: '#ffb3b3' },
    trashText: { ...base.trashText, color: '#ad9994' },
    empty: { ...base.empty, color: '#b6a19d' },
    note: { ...base.note, backgroundColor: '#34272a' },
    noteTitle: txt(base.noteTitle),
    noteText: { ...base.noteText, color: '#c5aeaa' },
    nameInput: { ...base.nameInput, backgroundColor: '#1c1719', color: '#f0e4e2', borderColor: '#403337' },
    appearance: bg(base.appearance),
    appearanceTitle: txt(base.appearanceTitle),
    appearanceHelp: { ...base.appearanceHelp, color: '#b6a19d' },
    appearanceOption: { ...base.appearanceOption, backgroundColor: '#1c1719' },
    appearanceSelected: { ...base.appearanceSelected, backgroundColor: '#660000' },
    appearanceText: { ...base.appearanceText, color: '#c5aeaa' },
    appearanceSelectedText: { ...base.appearanceSelectedText, color: '#fff' },
    modalBackdrop: { ...base.modalBackdrop, backgroundColor: 'rgba(0,0,0,0.65)' },
    confirmModal: { ...base.confirmModal, backgroundColor: '#241d20', borderColor: '#3a2e32' },
    confirmTitle: txt(base.confirmTitle),
    confirmDate: { ...base.confirmDate, color: '#ffb3b3' },
    confirmHelp: { ...base.confirmHelp, color: '#c5aeaa' },
    modalCancel: { ...base.modalCancel, backgroundColor: '#34272a' },
    modalCancelText: { ...base.modalCancelText, color: '#f0e4e2' },
    modalConfirm: { ...base.modalConfirm, backgroundColor: '#660000' },
    settingsButton: { ...base.settingsButton, backgroundColor: '#34272a' },
    settingsIcon: { ...base.settingsIcon, color: '#ffb3b3' },
  };
};
