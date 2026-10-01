import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import * as SQLite from 'expo-sqlite';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Period = { id: number; start_date: string; end_date: string | null; total_days: number | null };
type ThemePreference = 'system' | 'light' | 'dark';

const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const today = formatDate(new Date());
const pretty = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const days = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);

const migrateDb = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      total_days INTEGER
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(periods)');
  if (!columns.some(column => column.name === 'total_days')) {
    await db.execAsync('ALTER TABLE periods ADD COLUMN total_days INTEGER;');
    await db.execAsync('UPDATE periods SET total_days = CASE WHEN end_date IS NOT NULL THEN CAST(julianday(end_date) - julianday(start_date) AS INTEGER) + 1 ELSE NULL END;');
  }
};

function TrackerContent() {
  const db = SQLite.useSQLiteContext();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [tab, setTab] = useState<'home' | 'history' | 'settings'>('home');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [filter, setFilter] = useState('All');
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [displayName, setDisplayName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const systemColorScheme = useColorScheme();
  const isDark = themePreference === 'dark' || (themePreference === 'system' && systemColorScheme === 'dark');
  const s = useMemo(() => makeStyles(isDark), [isDark]);

  const refresh = () => {
    try {
      setPeriods(db.getAllSync<Period>('SELECT id, start_date, end_date, total_days FROM periods ORDER BY start_date DESC'));
    } catch (e) {
      console.error('Failed to load periods:', e);
    }
  };

  useEffect(() => {
    try {
      const savedTheme = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'theme')?.value;
      if (savedTheme === 'system' || savedTheme === 'light' || savedTheme === 'dark') setThemePreference(savedTheme);
      const savedName = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'name')?.value ?? '';
      setDisplayName(savedName);
      setNameDraft(savedName);
      refresh();
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, [db]);

  const ordered = useMemo(() => [...periods].reverse(), [periods]);
  const previousPeriodById = useMemo(() => new Map(ordered.map((period, index) => [period.id, index > 0 ? ordered[index - 1] : null])), [ordered]);
  const shown = useMemo(() => {
    if (filter === 'All') return periods;
    if (filter === 'Recent') return periods.slice(0, 5);
    return periods.filter(p => p.start_date.startsWith(filter));
  }, [periods, filter]);
  const completed = periods.filter(p => p.end_date);
  const avgLength = completed.length ? Math.ceil(completed.reduce((sum, p) => sum + (p.total_days ?? 0), 0) / completed.length) : null;
  const cycles = ordered.slice(1).map((p, i) => days(ordered[i].start_date, p.start_date) - 1).filter(n => n <= 50);
  const avgCycle = cycles.length ? Math.ceil(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;

  const save = () => {
    if (end && end < start) return Alert.alert('Check your dates', 'The end date must be on or after the start date.');
    const totalDays = end ? days(start, end) + 1 : null;
    if (editing) db.runSync('UPDATE periods SET start_date = ?, end_date = ?, total_days = ? WHERE id = ?', start, end || null, totalDays, editing);
    else db.runSync('INSERT INTO periods (start_date, end_date, total_days) VALUES (?, ?, ?)', start, end || null, totalDays);
    setStart(today); setEnd(''); setEditing(null); refresh();
  };
  const onDateValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    if (picker === 'start') setStart(formatDate(selectedDate));
    if (picker === 'end') setEnd(formatDate(selectedDate));
    if (Platform.OS === 'android') setPicker(null);
  };
  const onDateDismiss = () => {
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
  };
  const edit = (p: Period) => { setStart(p.start_date); setEnd(p.end_date || ''); setEditing(p.id); setTab('home'); };
  const remove = (id: number) => Alert.alert('Delete this record?', 'This period will be removed from your history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { db.runSync('DELETE FROM periods WHERE id = ?', id); refresh(); } }]);
  const years = ['All', 'Recent', ...Array.from(new Set(periods.map(p => p.start_date.slice(0, 4))))];
  const recentPeriods = periods.slice(0, 5);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#171315' : '#fff8f6'} />
      <View style={s.top}>
        <View>
          <Text style={s.eyebrow}>Because privacy is important</Text>
          <Text style={s.brand}>🙈 Period Tracker</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Settings" style={s.settingsButton} onPress={() => setTab('settings')}>
          <Text style={s.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {tab === 'home' ? <>
          <Text style={s.greeting}>{displayName ? `Hi There, ${displayName}!` : 'Hi There!'}</Text>
          <View style={s.stats}><View style={s.stat}><Text style={s.statIcon}>🩸</Text><Text style={s.statNum}>{avgLength ? `${avgLength} days` : '—'}</Text><Text style={s.statLabel}>AVG. PERIOD</Text></View><View style={s.stat}><Text style={s.statIcon}>☀️</Text><Text style={s.statNum}>{avgCycle ? `${avgCycle} days` : '—'}</Text><Text style={s.statLabel}>AVG. CYCLE</Text></View></View>

          <View style={s.card}><Text style={s.section}>{editing ? 'Update a period' : 'Log a period'}</Text><Text style={s.label}>START DATE</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Choose start date, ${pretty(start)}`} style={s.dateButton} onPress={() => setPicker('start')}><Text style={s.dateText}>▦  {pretty(start)}</Text><Text style={s.dateHint}>Change</Text></TouchableOpacity>
            <Text style={s.label}>END DATE <Text style={s.optional}>· OPTIONAL</Text></Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={end ? `Choose end date, ${pretty(end)}` : 'Choose end date'} style={s.dateButton} onPress={() => setPicker('end')}><Text style={[s.dateText, !end && s.datePlaceholder]}>{end ? `▦  ${pretty(end)}` : 'Choose an end date'}</Text>{end ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear end date" onPress={() => setEnd('')}><Text style={s.clearDate}>Clear</Text></TouchableOpacity> : <Text style={s.dateHint}>Optional</Text>}</TouchableOpacity>
            {picker && <DateTimePicker value={picker === 'start' ? parseDate(start) : end ? parseDate(end) : parseDate(start)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} maximumDate={new Date()} minimumDate={picker === 'end' ? parseDate(start) : undefined} themeVariant={isDark ? 'dark' : 'light'} onValueChange={onDateValueChange} onDismiss={onDateDismiss} />}
            {picker && Platform.OS === 'ios' && <TouchableOpacity style={s.pickerDone} onPress={() => setPicker(null)}><Text style={s.pickerDoneText}>Done</Text></TouchableOpacity>}
            <TouchableOpacity style={s.button} onPress={save}><Text style={s.buttonText}>{editing ? 'Save changes' : 'Save period'}  →</Text></TouchableOpacity>{editing && <TouchableOpacity onPress={() => { setEditing(null); setStart(today); setEnd(''); }}><Text style={s.cancel}>Cancel editing</Text></TouchableOpacity>}</View>
          <Text style={s.section}>Recent periods</Text>{recentPeriods.map(p => <PeriodCard key={p.id} p={p} previousPeriod={previousPeriodById.get(p.id) ?? null} s={s} onEdit={edit} onDelete={remove} />)}{!periods.length && <Text style={s.empty}>Your saved periods will appear here.</Text>}
          {periods.length > 5 && <TouchableOpacity onPress={() => setTab('history')}><Text style={s.more}>See all periods →</Text></TouchableOpacity>}
        </> : tab === 'history' ? <><Text style={s.greeting}>Your history</Text><Text style={s.sub}>All the notes you’ve logged, in one place.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters}>{years.map(y => <TouchableOpacity key={y} style={[s.chip, filter === y && s.chipOn]} onPress={() => setFilter(y)}><Text style={[s.chipText, filter === y && s.chipTextOn]}>{y === 'Recent' ? 'Recent 5' : y}</Text></TouchableOpacity>)}</ScrollView>
          <View style={s.historyStats}><Text style={s.historyCount}>{shown.length}</Text><Text style={s.historyLabel}>{filter === 'All' ? 'TOTAL RECORDS' : filter === 'Recent' ? 'MOST RECENT' : `STARTED IN ${filter}`}</Text></View>
          {shown.map(p => <PeriodCard key={p.id} p={p} previousPeriod={previousPeriodById.get(p.id) ?? null} s={s} onEdit={edit} onDelete={remove} />)}{!shown.length && <Text style={s.empty}>No periods to show yet. Start by logging one.</Text>}
          <View style={s.note}><Text style={s.noteTitle}>A note about your averages</Text><Text style={s.noteText}>Average period length uses completed records. Cycle length is counted from the previous period’s start date to the date before the current period’s start date. Gaps over 50 days are flagged in your history.</Text></View>
        </> : <>
          <Text style={s.greeting}>Settings</Text><Text style={s.sub}>Make your tracker feel like yours.</Text>
          <View style={s.card}><Text style={s.section}>Your name</Text><Text style={s.appearanceHelp}>Add a name for your personal welcome.</Text><TextInput accessibilityLabel="Your name" value={nameDraft} onChangeText={setNameDraft} placeholder="Enter your name" placeholderTextColor={isDark ? '#a99591' : '#b4a8a6'} maxLength={40} returnKeyType="done" onSubmitEditing={saveName} style={s.nameInput} /><TouchableOpacity style={s.button} onPress={saveName}><Text style={s.buttonText}>Save name</Text></TouchableOpacity></View>
          <View style={s.appearance}><Text style={s.appearanceTitle}>Appearance</Text><Text style={s.appearanceHelp}>Choose a theme or follow your device setting.</Text><View style={s.appearanceOptions}>{(['system', 'light', 'dark'] as const).map(option => <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: themePreference === option }} style={[s.appearanceOption, themePreference === option && s.appearanceSelected]} onPress={() => chooseTheme(option)}><Text style={[s.appearanceText, themePreference === option && s.appearanceSelectedText]}>{option[0].toUpperCase() + option.slice(1)}</Text></TouchableOpacity>)}</View></View>
        </>}
      </ScrollView>
      <View style={s.nav}><TouchableOpacity style={s.navItem} onPress={() => setTab('home')}><Text style={[s.navIcon, tab === 'home' && s.active]}>⌂</Text><Text style={[s.navText, tab === 'home' && s.active]}>Today</Text></TouchableOpacity><TouchableOpacity style={s.navItem} onPress={() => setTab('history')}><Text style={[s.navIcon, tab === 'history' && s.active]}>▤</Text><Text style={[s.navText, tab === 'history' && s.active]}>History</Text></TouchableOpacity></View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={null}>
        <SQLite.SQLiteProvider databaseName="period-tracker.db" onInit={migrateDb} useSuspense>
          <TrackerContent />
        </SQLite.SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

function PeriodCard({ p, previousPeriod, s, onEdit, onDelete }: { p: Period; previousPeriod: Period | null; s: ReturnType<typeof makeStyles>; onEdit: (p: Period) => void; onDelete: (id: number) => void }) {
  const cycleDays = previousPeriod ? days(previousPeriod.start_date, p.start_date) - 1 : null;
  const cycleText = previousPeriod === null ? 'First record' : cycleDays! > 50 ? `>50 days gap in records (${cycleDays} days)` : `${cycleDays} days cycle length`;
  const cycleIsLong = cycleDays !== null && cycleDays > 50;
  return <View style={s.period}><View style={s.periodIcon}><Text style={{ fontSize: 18 }}>🩸</Text></View><View style={{ flex: 1 }}><Text style={s.periodDate}>{pretty(p.start_date)} – {p.end_date ? pretty(p.end_date) : 'Ongoing'}</Text><Text style={s.periodMeta}>{p.total_days !== null ? `${p.total_days} days` : 'In progress'}</Text><Text style={[s.periodGap, cycleIsLong && s.periodGapWarning]}>{cycleText}</Text></View><TouchableOpacity style={s.action} onPress={() => onEdit(p)}><Text style={s.actionText}>Edit</Text></TouchableOpacity><TouchableOpacity style={s.trash} onPress={() => onDelete(p.id)}><Text style={{ color: '#aa8987', fontSize: 16 }}>×</Text></TouchableOpacity></View>;
}

const makeStyles = (dark: boolean) => {
  const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#fff8f6' }, top: { height: 66, paddingHorizontal: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, settingsButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f5e6e1', alignItems: 'center', justifyContent: 'center' }, settingsIcon: { color: '#660000', fontSize: 22 }, eyebrow: { fontSize: 9, letterSpacing: 2, color: '#a18d88', fontWeight: '700' }, brand: { fontSize: 27, fontWeight: '800', letterSpacing: -1, color: '#563f3d' }, brandDot: { color: '#660000' }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5e6e1', alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 21, paddingBottom: 26 }, greeting: { fontSize: 25, fontWeight: '700', letterSpacing: -.5, color: '#483735', marginTop: 12 }, sub: { fontSize: 13, color: '#968582', marginTop: 5, marginBottom: 19 }, hero: { marginTop: 14, backgroundColor: '#f3e3df', borderRadius: 22, padding: 17, justifyContent: 'center', overflow: 'hidden' }, heroKicker: { fontSize: 9, letterSpacing: 1.7, fontWeight: '700', color: '#660000' }, heroTitle: { fontSize: 21, fontWeight: '700', color: '#583f3c', marginTop: 10, maxWidth: '85%' }, flower: { position: 'absolute', right: 13, bottom: -23, fontSize: 100, color: '#e9c9c3' }, section: { fontSize: 17, fontWeight: '700', color: '#503d3a', marginTop: 23, marginBottom: 12 }, stats: { flexDirection: 'row', gap: 11, marginTop: 14 }, stat: { flex: 1, backgroundColor: '#fff', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#f2e8e5' }, statIcon: { fontSize: 18 }, statNum: { fontSize: 20, fontWeight: '700', color: '#563f3d', marginTop: 7 }, statLabel: { fontSize: 9, letterSpacing: 1, color: '#a18d88', marginTop: 5, fontWeight: '700' }, card: { backgroundColor: '#fff', borderRadius: 20, padding: 17, marginTop: 24, borderWidth: 1, borderColor: '#f2e8e5' }, label: { fontSize: 9, letterSpacing: 1.3, fontWeight: '700', color: '#9b8580', marginTop: 10, marginBottom: 7 }, optional: { color: '#c5b4b0', fontWeight: '500' }, nameInput: { height: 47, marginTop: 12, borderRadius: 12, backgroundColor: '#fcf7f5', paddingHorizontal: 13, color: '#503d3a', fontSize: 14, borderWidth: 1, borderColor: '#f1e8e5' }, dateButton: { height: 47, borderRadius: 12, backgroundColor: '#fcf7f5', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f1e8e5' }, dateText: { color: '#503d3a', fontSize: 14 }, datePlaceholder: { color: '#b4a8a6' }, dateHint: { fontSize: 11, color: '#aa8984' }, clearDate: { fontSize: 11, color: '#660000', fontWeight: '600' }, pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 9 }, pickerDoneText: { color: '#660000', fontWeight: '700' }, button: { backgroundColor: '#660000', height: 49, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, cancel: { textAlign: 'center', marginTop: 12, color: '#660000', fontSize: 12 }, period: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 15, marginBottom: 9, borderWidth: 1, borderColor: '#f3eae7' }, periodIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#f8eeeb', alignItems: 'center', justifyContent: 'center' }, periodDate: { fontSize: 12, fontWeight: '600', color: '#594541' }, periodMeta: { fontSize: 11, color: '#a08d87', marginTop: 4 }, periodGap: { fontSize: 10, color: '#a08d87', marginTop: 3 }, periodGapWarning: { color: '#660000', fontWeight: '700' }, action: { padding: 6 }, actionText: { fontSize: 11, color: '#660000', fontWeight: '600' }, trash: { width: 25, height: 28, alignItems: 'center', justifyContent: 'center' }, empty: { color: '#a08d87', fontSize: 12, paddingVertical: 12 }, more: { textAlign: 'center', color: '#660000', fontSize: 12, fontWeight: '600', padding: 12 }, privacy: { textAlign: 'center', fontSize: 10, color: '#ad9c97', marginTop: 24, marginBottom: 9 }, nav: { height: 64, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1e8e5', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }, navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 80 }, navIcon: { fontSize: 21, color: '#b8a7a2' }, navText: { fontSize: 10, color: '#ad9c97', marginTop: 1 }, active: { color: '#660000', fontWeight: '700' }, filters: { flexGrow: 0, marginBottom: 13 }, chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#f5eae7', marginRight: 8 }, chipOn: { backgroundColor: '#660000' }, chipText: { fontSize: 11, color: '#8d7772' }, chipTextOn: { color: '#fff', fontWeight: '700' }, historyStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 8 }, historyCount: { fontSize: 22, fontWeight: '700', color: '#563f3d' }, historyLabel: { fontSize: 9, letterSpacing: 1, color: '#a18d88', fontWeight: '700' }, appearance: { backgroundColor: '#fff', borderRadius: 17, padding: 15, marginTop: 18, borderWidth: 1, borderColor: '#f2e8e5' }, appearanceTitle: { fontSize: 14, fontWeight: '700', color: '#503d3a' }, appearanceHelp: { fontSize: 11, color: '#968582', marginTop: 4 }, appearanceOptions: { flexDirection: 'row', gap: 8, marginTop: 12 }, appearanceOption: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: '#fcf7f5' }, appearanceSelected: { backgroundColor: '#660000' }, appearanceText: { fontSize: 11, color: '#8d7772', fontWeight: '600' }, appearanceSelectedText: { color: '#fff' }, trashText: { color: '#aa8987', fontSize: 16 }, note: { backgroundColor: '#f5eae7', padding: 15, borderRadius: 15, marginTop: 15 }, noteTitle: { fontSize: 12, fontWeight: '700', color: '#704e49' }, noteText: { fontSize: 11, lineHeight: 17, color: '#907a75', marginTop: 6 } });
  if (!dark) return styles;
  return {
    ...styles,
    settingsButton: { ...styles.settingsButton, backgroundColor: '#34272a' }, settingsIcon: { ...styles.settingsIcon, color: '#ffb3b3' }, nameInput: { ...styles.nameInput, backgroundColor: '#1c1719', color: '#f0e4e2', borderColor: '#403337' },
    safe: { ...styles.safe, backgroundColor: '#171315' },
    eyebrow: { ...styles.eyebrow, color: '#ad9994' }, brand: { ...styles.brand, color: '#f3e8e6' }, brandDot: { ...styles.brandDot, color: '#ffb3b3' }, avatar: { ...styles.avatar, backgroundColor: '#34272a' },
    greeting: { ...styles.greeting, color: '#f3e8e6' }, sub: { ...styles.sub, color: '#bdaaa6' },
    hero: { ...styles.hero, backgroundColor: '#34272a' }, heroKicker: { ...styles.heroKicker, color: '#ffb3b3' }, heroTitle: { ...styles.heroTitle, color: '#f3e8e6' }, flower: { ...styles.flower, color: '#594044' },
    section: { ...styles.section, color: '#f0e4e2' }, stat: { ...styles.stat, backgroundColor: '#241d20', borderColor: '#3a2e32' }, statNum: { ...styles.statNum, color: '#f3e8e6' }, statLabel: { ...styles.statLabel, color: '#ad9994' },
    card: { ...styles.card, backgroundColor: '#241d20', borderColor: '#3a2e32' }, label: { ...styles.label, color: '#c2aaa6' }, optional: { ...styles.optional, color: '#9f8985' }, dateButton: { ...styles.dateButton, backgroundColor: '#1c1719', borderColor: '#403337' }, dateText: { ...styles.dateText, color: '#f0e4e2' }, datePlaceholder: { ...styles.datePlaceholder, color: '#a99591' }, dateHint: { ...styles.dateHint, color: '#bba09c' }, clearDate: { ...styles.clearDate, color: '#ffb3b3' }, pickerDoneText: { ...styles.pickerDoneText, color: '#ffb3b3' },
    button: { ...styles.button, backgroundColor: '#660000' }, cancel: { ...styles.cancel, color: '#ffb3b3' },
    period: { ...styles.period, backgroundColor: '#241d20', borderColor: '#3a2e32' }, periodIcon: { ...styles.periodIcon, backgroundColor: '#34272a' }, periodDate: { ...styles.periodDate, color: '#f0e4e2' }, periodMeta: { ...styles.periodMeta, color: '#b6a19d' }, periodGap: { ...styles.periodGap, color: '#b6a19d' }, periodGapWarning: { ...styles.periodGapWarning, color: '#ffb3b3' }, actionText: { ...styles.actionText, color: '#ffb3b3' }, trashText: { ...styles.trashText, color: '#ad9994' }, empty: { ...styles.empty, color: '#b6a19d' }, more: { ...styles.more, color: '#ffb3b3' }, privacy: { ...styles.privacy, color: '#a99591' },
    nav: { ...styles.nav, backgroundColor: '#211a1d', borderTopColor: '#3a2e32' }, navIcon: { ...styles.navIcon, color: '#9f8985' }, navText: { ...styles.navText, color: '#a99591' }, active: { ...styles.active, color: '#ffb3b3' },
    chip: { ...styles.chip, backgroundColor: '#34272a' }, chipOn: { ...styles.chipOn, backgroundColor: '#660000' }, chipText: { ...styles.chipText, color: '#c5aeaa' },
    historyCount: { ...styles.historyCount, color: '#f3e8e6' }, historyLabel: { ...styles.historyLabel, color: '#ad9994' }, note: { ...styles.note, backgroundColor: '#34272a' }, noteTitle: { ...styles.noteTitle, color: '#f0e4e2' }, noteText: { ...styles.noteText, color: '#c5aeaa' },
    appearance: { ...styles.appearance, backgroundColor: '#241d20', borderColor: '#3a2e32' }, appearanceTitle: { ...styles.appearanceTitle, color: '#f0e4e2' }, appearanceHelp: { ...styles.appearanceHelp, color: '#b6a19d' }, appearanceOption: { ...styles.appearanceOption, backgroundColor: '#1c1719' }, appearanceSelected: { ...styles.appearanceSelected, backgroundColor: '#660000' }, appearanceText: { ...styles.appearanceText, color: '#c5aeaa' }, appearanceSelectedText: { ...styles.appearanceSelectedText, color: '#fff' },
  };
};
