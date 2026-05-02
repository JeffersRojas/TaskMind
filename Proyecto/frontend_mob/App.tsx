import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const API_HOST = process.env.EXPO_PUBLIC_API_HOST ?? '172.28.95.140';
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '5000';
const API_URL = `http://${API_HOST}:${API_PORT}/api`;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

type Priority = 'Alta' | 'Media' | 'Baja';
type Subject = string;
type Screen = 'login' | 'register' | 'home' | 'new-task' | 'detail' | 'progress' | 'admin';

type Task = {
  _id: string; // MongoDB usa _id
  id?: string; // Para compatibilidad
  title: string;
  subject: Subject;
  subjectId?: any;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

type UserData = {
  _id: string;
  name: string;
  email: string;
  role?: 'admin' | 'user';
  token: string;
};

type FormState = {
  title: string;
  subject: Subject;
  dueDate: string;
  priority: Priority;
};

type FormMode = 'create' | 'edit';

type AuthForm = {
  email: string;
  password: string;
};

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type Account = {
  name: string;
  email: string;
  password: string;
};

type SubjectColors = { card: string; light: string };
type SubjectFromApi = { _id: string; name: string; colors: SubjectColors };

const defaultSubjectList: Subject[] = ['Matemáticas', 'Ciencias', 'Español', 'Historia'];
const defaultSubjectColors: Record<string, SubjectColors> = {
  Matemáticas: { card: '#3C7BEA', light: '#DCE7FF' },
  Ciencias: { card: '#71B452', light: '#E3F2DA' },
  Español: { card: '#8467D7', light: '#E7DEFF' },
  Historia: { card: '#E29A4B', light: '#FBE8D4' },
};

function getPaletteForSubject(
  subject: string,
  paletteMap: Record<string, SubjectColors>,
): SubjectColors {
  return paletteMap[subject] ?? { card: '#3C7BEA', light: '#DCE7FF' };
}

const initialTasks: Task[] = [
  {
    _id: '1',
    id: '1',
    title: 'Taller 3',
    subject: 'Matemáticas',
    dueDate: '25 Mar',
    priority: 'Alta',
    completed: false,
  },
  {
    _id: '2',
    id: '2',
    title: 'Exposición',
    subject: 'Ciencias',
    dueDate: '28 Mar',
    priority: 'Media',
    completed: false,
  },
  {
    _id: '3',
    id: '3',
    title: 'Ensayo',
    subject: 'Español',
    dueDate: '30 Mar',
    priority: 'Baja',
    completed: true,
  },
  {
    _id: '4',
    id: '4',
    title: 'Resumen',
    subject: 'Historia',
    dueDate: '02 Abr',
    priority: 'Media',
    completed: true,
  },
];

const initialForm: FormState = {
  title: '',
  subject: 'Matemáticas',
  dueDate: '',
  priority: 'Alta',
};

const initialAuthForm: AuthForm = {
  email: '',
  password: '',
};

const initialRegisterForm: RegisterForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const defaultAccount: Account = {
  name: 'Estudiante Demo',
  email: 'demo@taskmind.com',
  password: '1234',
};

function formatUserName(email: string) {
  const baseName = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Estudiante';
  return baseName
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [screen, setScreen] = useState<Screen>('login');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [form, setForm] = useState<FormState>(initialForm);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [authForm, setAuthForm] = useState<AuthForm>(initialAuthForm);
  const [registerForm, setRegisterForm] = useState<RegisterForm>(initialRegisterForm);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [subjects, setSubjects] = useState<SubjectFromApi[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUserForm, setAdminUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin',
  });
  const [newSubjectName, setNewSubjectName] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  const selectedTask = tasks.find((task) => task._id === selectedTaskId) || tasks[0];
  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const subjectPaletteByName = useMemo(() => {
    const fromApi: Record<string, SubjectColors> = {};
    for (const s of subjects) {
      fromApi[s.name] = s.colors;
    }
    return { ...defaultSubjectColors, ...fromApi };
  }, [subjects]);

  const availableSubjects = useMemo(() => {
    const apiNames = subjects.map((s) => s.name);
    return apiNames.length > 0 ? apiNames : defaultSubjectList;
  }, [subjects]);

  const weeklyMessage = useMemo(() => {
    if (progress >= 75) {
      return '¡Vas muy bien! 💪';
    }

    if (progress >= 50) {
      return 'Buen avance, sigue así.';
    }

    return 'Organiza tus tareas para subir tu progreso.';
  }, [progress]);

  const startEditingSelectedTask = () => {
    if (!selectedTask) return;
    setForm({
      title: selectedTask.title,
      subject: selectedTask.subject,
      dueDate: selectedTask.dueDate,
      priority: selectedTask.priority,
    });
    setFormMode('edit');
    setScreen('new-task');
  };

  // Cargar tareas cuando el usuario se loguea
  useEffect(() => {
    if (userData) {
      fetchSubjects();
      fetchTasks();
    }
  }, [userData]);

  useEffect(() => {
    if (screen === 'admin' && userData?.role === 'admin') {
      refreshAdminData();
    }
  }, [screen, userData]);

  const fetchSubjects = async () => {
    if (!userData) return;
    try {
      const response = await fetchWithTimeout(`${API_URL}/subjects`, {
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setSubjects(data);
        if (!form.subject && data.length > 0) {
          setForm((current) => ({ ...current, subject: data[0].name }));
        }
      }
    } catch (error) {
      setSubjects([]);
    }
  };

  const fetchTasks = async () => {
    if (!userData) return;
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/tasks`, {
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });
      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!userData) return;
    const response = await fetchWithTimeout(`${API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${userData.token}`
      }
    });
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      setAdminUsers(data);
      setAdminError('');
      return;
    }
    setAdminError(data?.message || 'No se pudieron cargar los usuarios');
  };

  const refreshAdminData = async () => {
    setAdminBusy(true);
    try {
      await Promise.all([fetchSubjects(), fetchUsers()]);
    } finally {
      setAdminBusy(false);
    }
  };

  const createAdminUser = async () => {
    if (!userData) return;
    const name = adminUserForm.name.trim();
    const email = adminUserForm.email.trim().toLowerCase();
    const password = adminUserForm.password.trim();
    const role = adminUserForm.role;

    if (!name || !email || !password) {
      setAdminError('Completa nombre, correo y contraseña.');
      return;
    }

    setAdminBusy(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token}`
        },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminError(data?.message || 'No se pudo crear el usuario');
        return;
      }
      setAdminUserForm({ name: '', email: '', password: '', role: 'user' });
      await fetchUsers();
    } finally {
      setAdminBusy(false);
    }
  };

  const updateAdminUserRole = async (targetUserId: string, role: 'user' | 'admin') => {
    if (!userData) return;
    setAdminBusy(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/users/${targetUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token}`
        },
        body: JSON.stringify({ role })
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminError(data?.message || 'No se pudo actualizar el usuario');
        return;
      }
      await fetchUsers();
    } finally {
      setAdminBusy(false);
    }
  };

  const deleteAdminUser = async (targetUserId: string) => {
    if (!userData) return;
    setAdminBusy(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/users/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminError(data?.message || 'No se pudo eliminar el usuario');
        return;
      }
      await fetchUsers();
    } finally {
      setAdminBusy(false);
    }
  };

  const createSubjectFromAdmin = async () => {
    if (!userData) return;
    const name = newSubjectName.trim();
    if (!name) {
      setAdminError('Escribe el nombre de la materia.');
      return;
    }
    setAdminBusy(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token}`
        },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminError(data?.message || 'No se pudo crear la materia');
        return;
      }
      setNewSubjectName('');
      await fetchSubjects();
    } finally {
      setAdminBusy(false);
    }
  };

  const deleteSubjectFromAdmin = async (subjectId: string) => {
    if (!userData) return;
    setAdminBusy(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/subjects/${subjectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminError(data?.message || 'No se pudo eliminar la materia');
        return;
      }
      await fetchSubjects();
    } finally {
      setAdminBusy(false);
    }
  };

  const handleLogin = async () => {
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password.trim();

    if (!email || !password) {
      setLoginError('Completa tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setUserData(data);
        setAuthForm(initialAuthForm);
        setLoginError('');
        setLoginMessage('');
        setScreen('home');
      } else {
        setLoginError(data.message || 'Error al iniciar sesión');
      }
    } catch (error) {
      setLoginError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    const { name, email, password, confirmPassword } = registerForm;

    if (!name || !email || !password || !confirmPassword) {
      setRegisterError('Completa todos los campos.');
      return;
    }

    if (password !== confirmPassword) {
      setRegisterError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setRegisterForm(initialRegisterForm);
        setRegisterError('');
        setLoginMessage('Cuenta creada. Ahora inicia sesión.');
        setScreen('login');
      } else {
        setRegisterError(data.message || 'Error al registrarse');
      }
    } catch (error) {
      setRegisterError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUserData(null);
    setTasks([]);
    setScreen('login');
  };

  const openTaskDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setScreen('detail');
  };

  const toggleTaskStatus = async (taskId: string) => {
    if (!userData) return;
    const taskToToggle = tasks.find(t => t._id === taskId);
    if (!taskToToggle) return;

    try {
      const response = await fetchWithTimeout(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token}`
        },
        body: JSON.stringify({ completed: !taskToToggle.completed })
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error al actualizar tarea:', error);
    }
  };

  const saveTask = async () => {
    if (!userData || !form.title.trim() || !form.dueDate.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token}`
        },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks([newTask, ...tasks]);
        setSelectedTaskId(newTask._id);
        setForm(initialForm);
        setScreen('detail');
      }
    } catch (error) {
      console.error('Error al guardar tarea:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSelectedTask = async () => {
    if (!userData || !selectedTask) return;

    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/tasks/${selectedTask._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });

      if (response.ok) {
        setTasks(tasks.filter(t => t._id !== selectedTask._id));
        setScreen('home');
      }
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTask = async () => {
    if (!userData || !selectedTask) return;

    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/tasks/${selectedTask._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token}`
        },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        fetchTasks();
        setFormMode('create');
        setScreen('detail');
      }
    } catch (error) {
      console.error('Error al actualizar tarea:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.phoneFrame}>
        {screen === 'login' && (
          <View style={styles.screenContainer}>
            <View style={styles.loginHero}>
              <Text style={styles.loginLogo}>🎓 TaskMind</Text>
              <Text style={styles.loginTitle}>Inicia sesión</Text>
              <Text style={styles.loginSubtitle}>
                Organiza tus estudios, tareas y progreso semanal desde un solo lugar.
              </Text>
            </View>

            <View style={styles.loginCard}>
              <Field label="Correo">
                <TextInput
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#9A9A9A"
                  style={styles.input}
                  value={authForm.email}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(email) => setAuthForm((current) => ({ ...current, email }))}
                />
              </Field>

              <Field label="Contraseña">
                <TextInput
                  placeholder="Tu contraseña"
                  placeholderTextColor="#9A9A9A"
                  style={styles.input}
                  value={authForm.password}
                  secureTextEntry
                  onChangeText={(password) =>
                    setAuthForm((current) => ({ ...current, password }))
                  }
                />
              </Field>

              <Text style={loginError ? styles.loginError : styles.loginHint}>
                {loginError ||
                  loginMessage ||
                  'Usa tu cuenta o regístrate para entrar a TaskMind.'}
              </Text>

              {isLoading && <ActivityIndicator size="large" color="#3C7BEA" style={{ marginVertical: 10 }} />}

              <Pressable onPress={handleLogin} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Entrar</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLoginError('');
                  setLoginMessage('');
                  setRegisterError('');
                  setRegisterForm(initialRegisterForm);
                  setScreen('register');
                }}
                style={styles.authLinkButton}
              >
                <Text style={styles.authLinkText}>Crear cuenta</Text>
              </Pressable>
            </View>

            <View style={styles.loginBadgeRow}>
              <View style={styles.loginBadge}>
                <Text style={styles.loginBadgeNumber}>{tasks.length}</Text>
                <Text style={styles.loginBadgeLabel}>Tareas base</Text>
              </View>
              <View style={styles.loginBadge}>
                <Text style={styles.loginBadgeNumber}>{completedCount}</Text>
                <Text style={styles.loginBadgeLabel}>Completadas</Text>
              </View>
              <View style={styles.loginBadge}>
                <Text style={styles.loginBadgeNumber}>{progress}%</Text>
                <Text style={styles.loginBadgeLabel}>Progreso</Text>
              </View>
            </View>
          </View>
        )}

        {screen === 'register' && (
          <View style={styles.screenContainer}>
            <View style={styles.headerBar}>
              <Pressable
                onPress={() => {
                  setRegisterError('');
                  setScreen('login');
                }}
              >
                <Text style={styles.headerIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Crear Cuenta</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.formContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.loginHero}>
                <Text style={styles.loginTitle}>Regístrate</Text>
                <Text style={styles.loginSubtitle}>
                  Si ya existe un administrador, solo él puede crear nuevas cuentas. Si es la primera cuenta, se creará como administrador.
                </Text>
              </View>

              <View style={styles.loginCard}>
                <Field label="Nombre completo">
                  <TextInput
                    placeholder="Ej. Ana López"
                    placeholderTextColor="#9A9A9A"
                    style={styles.input}
                    value={registerForm.name}
                    onChangeText={(name) => setRegisterForm((current) => ({ ...current, name }))}
                  />
                </Field>

                <Field label="Correo">
                  <TextInput
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor="#9A9A9A"
                    style={styles.input}
                    value={registerForm.email}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={(email) =>
                      setRegisterForm((current) => ({ ...current, email }))
                    }
                  />
                </Field>

                <Field label="Contraseña">
                  <TextInput
                    placeholder="Mínimo 4 caracteres"
                    placeholderTextColor="#9A9A9A"
                    style={styles.input}
                    value={registerForm.password}
                    secureTextEntry
                    onChangeText={(password) =>
                      setRegisterForm((current) => ({ ...current, password }))
                    }
                  />
                </Field>

                <Field label="Confirmar contraseña">
                  <TextInput
                    placeholder="Repite tu contraseña"
                    placeholderTextColor="#9A9A9A"
                    style={styles.input}
                    value={registerForm.confirmPassword}
                    secureTextEntry
                    onChangeText={(confirmPassword) =>
                      setRegisterForm((current) => ({ ...current, confirmPassword }))
                    }
                  />
                </Field>

                <Text style={registerError ? styles.loginError : styles.loginHint}>
                  {registerError || 'Si el registro está bloqueado, pide al administrador que te cree el usuario.'}
                </Text>

                {isLoading && <ActivityIndicator size="large" color="#3C7BEA" style={{ marginVertical: 10 }} />}

                <Pressable onPress={handleRegister} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Registrarme</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}

        {screen === 'home' && (
          <View style={styles.screenContainer}>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.greeting}>Hola, {userData?.name}</Text>
                <Text style={styles.logo}>🎓 TaskMind</Text>
              </View>
              <View style={styles.topBarActions}>
                {userData?.role === 'admin' && (
                  <Pressable onPress={() => setScreen('admin')} style={styles.headerChip}>
                    <Text style={styles.headerChipText}>Admin</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setScreen('progress')} style={styles.headerChip}>
                  <Text style={styles.headerChipText}>Progreso</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.tasksList}
              showsVerticalScrollIndicator={false}
            >
              {tasks.map((task) => {
                const palette = getPaletteForSubject(task.subject, subjectPaletteByName);

                return (
                  <Pressable
                    key={task._id}
                    onPress={() => {
                      setSelectedTaskId(task._id);
                      setScreen('detail');
                    }}
                    style={[styles.taskCard, { backgroundColor: palette.card }]}
                  >
                    <Text style={styles.taskSubject}>{task.subject}</Text>
                    <View style={styles.separator} />
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <View style={styles.taskFooter}>
                      <Text style={styles.taskMeta}>◔ {task.dueDate}</Text>
                      <View style={[styles.priorityBadge, { backgroundColor: palette.light }]}>
                        <Text style={styles.priorityText}>{task.priority}</Text>
                      </View>
                      <Pressable
                        onPress={() => toggleTaskStatus(task._id)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonText}>
                          {task.completed ? 'Hecha' : 'Completar'}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {isLoading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="large" color="#3C7BEA" />
              </View>
            )}

            <Pressable
              onPress={() => {
                setForm(initialForm);
                setFormMode('create');
                setScreen('new-task');
              }}
              style={styles.floatingButton}
            >
              <Text style={styles.floatingButtonText}>＋</Text>
            </Pressable>
          </View>
        )}

        {screen === 'new-task' && (
          <View style={styles.screenContainer}>
            <View style={styles.headerBar}>
              <Pressable onPress={() => setScreen(formMode === 'edit' && selectedTask ? 'detail' : 'home')}>
                <Text style={styles.headerIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Nueva Tarea</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.formContainer}
              showsVerticalScrollIndicator={false}
            >
              <Field label="Nombre de la tarea">
                <TextInput
                  placeholder="Ej. Hacer resumen"
                  placeholderTextColor="#9A9A9A"
                  style={styles.input}
                  value={form.title}
                  onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                />
              </Field>

              <Field label="Materia">
                <View style={styles.selector}>
                  {availableSubjects.map(
                    (subject) => (
                      <Pressable
                        key={subject}
                        onPress={() => setForm((current) => ({ ...current, subject }))}
                        style={[
                          styles.selectorOption,
                          form.subject === subject && styles.selectorOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectorText,
                            form.subject === subject && styles.selectorTextActive,
                          ]}
                        >
                          {subject}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </Field>

              <Field label="Fecha">
                <TextInput
                  placeholder="Selecciona fecha"
                  placeholderTextColor="#9A9A9A"
                  style={styles.input}
                  value={form.dueDate}
                  onChangeText={(dueDate) => setForm((current) => ({ ...current, dueDate }))}
                />
              </Field>

              <Field label="Prioridad">
                <View style={styles.priorityRow}>
                  {(['Alta', 'Media', 'Baja'] as Priority[]).map((priority) => (
                    <Pressable
                      key={priority}
                      onPress={() => setForm((current) => ({ ...current, priority }))}
                      style={[
                        styles.priorityOption,
                        form.priority === priority && styles.priorityOptionActive,
                        priority === 'Alta' && styles.priorityHigh,
                        priority === 'Media' && styles.priorityMedium,
                        priority === 'Baja' && styles.priorityLow,
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityOptionText,
                          form.priority === priority && styles.priorityOptionTextActive,
                        ]}
                      >
                        {priority}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <Pressable
                onPress={formMode === 'edit' ? updateTask : saveTask}
                style={styles.primaryButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {formMode === 'edit' ? 'Actualizar' : 'Guardar'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}

        {screen === 'detail' && selectedTask && (
          <View style={styles.screenContainer}>
            <View style={styles.headerBar}>
              <Pressable onPress={() => setScreen('home')}>
                <Text style={styles.headerIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Detalle de Tarea</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.detailCard}>
              <View
                style={[
                  styles.detailBanner,
                  { backgroundColor: getPaletteForSubject(selectedTask.subject, subjectPaletteByName).card },
                ]}
              >
                <Text style={styles.detailBannerText}>🎓 {selectedTask.subject}</Text>
              </View>
              <Text style={styles.detailTitle}>{selectedTask.title}</Text>
              <Text style={styles.detailMeta}>Fecha: {selectedTask.dueDate}</Text>
              <View style={styles.detailPriorityRow}>
                <Text style={styles.detailMeta}>Prioridad:</Text>
                <View style={styles.detailPriorityBadge}>
                  <Text style={styles.detailPriorityText}>{selectedTask.priority}</Text>
                </View>
              </View>
              <View style={styles.separatorDark} />
              <Text style={styles.detailDescription}>
                Organiza tu tiempo de estudio, prepara tus entregas y marca esta actividad cuando
                esté terminada.
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={startEditingSelectedTask} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Editar</Text>
              </Pressable>
              <Pressable onPress={deleteSelectedTask} style={styles.dangerButton}>
                <Text style={styles.secondaryButtonText}>Eliminar</Text>
              </Pressable>
            </View>
          </View>
        )}

        {screen === 'admin' && (
          <View style={styles.screenContainer}>
            <View style={styles.headerBar}>
              <Pressable onPress={() => setScreen('home')}>
                <Text style={styles.headerIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Administración</Text>
              <View style={styles.headerSpacer} />
            </View>

            {userData?.role !== 'admin' ? (
              <View style={styles.loginCard}>
                <Text style={styles.loginError}>Acceso denegado: solo administradores.</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.adminContainer}
                showsVerticalScrollIndicator={false}
              >
                {adminError ? (
                  <View style={styles.adminBannerError}>
                    <Text style={styles.adminBannerErrorText}>{adminError}</Text>
                  </View>
                ) : null}

                <View style={styles.loginCard}>
                  <View style={styles.adminCardHeader}>
                    <Text style={styles.adminCardTitle}>Materias</Text>
                    <Pressable onPress={refreshAdminData} style={styles.adminSmallButton} disabled={adminBusy}>
                      <Text style={styles.adminSmallButtonText}>Actualizar</Text>
                    </Pressable>
                  </View>

                  <Field label="Nueva materia">
                    <TextInput
                      placeholder="Ej. Inglés"
                      placeholderTextColor="#9A9A9A"
                      style={styles.input}
                      value={newSubjectName}
                      onChangeText={setNewSubjectName}
                    />
                  </Field>

                  <Pressable onPress={createSubjectFromAdmin} style={styles.primaryButton} disabled={adminBusy}>
                    <Text style={styles.primaryButtonText}>Crear materia</Text>
                  </Pressable>

                  <View style={styles.adminList}>
                    {subjects.map((s) => (
                      <View key={s._id} style={styles.adminRow}>
                        <View style={styles.adminRowLeftInline}>
                          <View style={[styles.adminColorDot, { backgroundColor: s.colors.card }]} />
                          <Text style={styles.adminRowTitle}>{s.name}</Text>
                        </View>
                        <Pressable
                          onPress={() => deleteSubjectFromAdmin(s._id)}
                          style={styles.adminDangerSmallButton}
                          disabled={adminBusy}
                        >
                          <Text style={styles.adminSmallButtonText}>Eliminar</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.loginCard}>
                  <Text style={styles.adminCardTitle}>Usuarios</Text>

                  <Field label="Nombre">
                    <TextInput
                      placeholder="Ej. Juan Pérez"
                      placeholderTextColor="#9A9A9A"
                      style={styles.input}
                      value={adminUserForm.name}
                      onChangeText={(name) => setAdminUserForm((current) => ({ ...current, name }))}
                    />
                  </Field>

                  <Field label="Correo">
                    <TextInput
                      placeholder="ejemplo@correo.com"
                      placeholderTextColor="#9A9A9A"
                      style={styles.input}
                      value={adminUserForm.email}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={(email) => setAdminUserForm((current) => ({ ...current, email }))}
                    />
                  </Field>

                  <Field label="Contraseña">
                    <TextInput
                      placeholder="Mínimo 4 caracteres"
                      placeholderTextColor="#9A9A9A"
                      style={styles.input}
                      value={adminUserForm.password}
                      secureTextEntry
                      onChangeText={(password) => setAdminUserForm((current) => ({ ...current, password }))}
                    />
                  </Field>

                  <Field label="Rol">
                    <View style={styles.selector}>
                      {(['user', 'admin'] as const).map((role) => (
                        <Pressable
                          key={role}
                          onPress={() => setAdminUserForm((current) => ({ ...current, role }))}
                          style={[
                            styles.selectorOption,
                            adminUserForm.role === role && styles.selectorOptionActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorText,
                              adminUserForm.role === role && styles.selectorTextActive,
                            ]}
                          >
                            {role === 'admin' ? 'Administrador' : 'Usuario'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </Field>

                  <Pressable onPress={createAdminUser} style={styles.primaryButton} disabled={adminBusy}>
                    <Text style={styles.primaryButtonText}>Crear usuario</Text>
                  </Pressable>

                  <View style={styles.adminList}>
                    {adminUsers.map((u: any) => (
                      <View key={u._id} style={styles.adminRow}>
                        <View style={styles.adminRowLeft}>
                          <Text style={styles.adminRowTitle}>{u.name}</Text>
                          <Text style={styles.adminRowSubtitle}>{u.email}</Text>
                        </View>
                        <View style={styles.adminRowRight}>
                          <Pressable
                            onPress={() => updateAdminUserRole(u._id, u.role === 'admin' ? 'user' : 'admin')}
                            style={styles.adminSmallButton}
                            disabled={adminBusy}
                          >
                            <Text style={styles.adminSmallButtonText}>
                              {u.role === 'admin' ? 'Hacer usuario' : 'Hacer admin'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => deleteAdminUser(u._id)}
                            style={styles.adminDangerSmallButton}
                            disabled={adminBusy}
                          >
                            <Text style={styles.adminSmallButtonText}>Eliminar</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {adminBusy && (
                  <View style={styles.adminBusyRow}>
                    <ActivityIndicator size="small" color="#3C7BEA" />
                    <Text style={styles.adminBusyText}>Procesando…</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {screen === 'progress' && (
          <View style={styles.screenContainer}>
            <View style={styles.headerBar}>
              <Pressable onPress={() => setScreen('home')}>
                <Text style={styles.headerIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Mi Progreso</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLine}>Completadas: {completedCount}</Text>
              <View style={styles.separatorDark} />
              <Text style={styles.summaryLine}>Pendientes: {pendingCount}</Text>
            </View>

            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Progreso Semanal</Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>

            <Text style={styles.encouragement}>{weeklyMessage}</Text>

            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.secondaryButtonText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ECECEC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneFrame: {
    width: '92%',
    maxWidth: 420,
    minHeight: 720,
    borderRadius: 30,
    backgroundColor: '#F6F2ED',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6,
    overflow: 'hidden',
  },
  screenContainer: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerSpacer: {
    width: 20,
  },
  iconText: {
    fontSize: 24,
    color: '#2E4F7A',
    fontWeight: '700',
  },
  headerIcon: {
    fontSize: 28,
    color: '#2E4F7A',
    fontWeight: '700',
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2E4F7A',
  },
  greeting: {
    fontSize: 16,
    fontWeight: '700',
    color: '#587398',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2E4F7A',
  },
  loginHero: {
    marginTop: 18,
    marginBottom: 24,
  },
  loginLogo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2E4F7A',
    marginBottom: 12,
  },
  loginTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#233A58',
    marginBottom: 10,
  },
  loginSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#61748D',
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 18,
    marginBottom: 22,
  },
  adminContainer: {
    gap: 18,
    paddingBottom: 40,
  },
  adminCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  adminCardTitle: {
    color: '#2F4668',
    fontSize: 20,
    fontWeight: '800',
  },
  adminBannerError: {
    backgroundColor: '#FFE6E6',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  adminBannerErrorText: {
    color: '#8A2D2D',
    fontWeight: '800',
  },
  adminList: {
    gap: 10,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F6F8FC',
  },
  adminRowLeft: {
    flex: 1,
    gap: 2,
  },
  adminRowLeftInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminRowTitle: {
    color: '#2F4668',
    fontWeight: '800',
    fontSize: 15,
  },
  adminRowSubtitle: {
    color: '#6B7F9A',
    fontWeight: '700',
    fontSize: 12,
  },
  adminColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  adminSmallButton: {
    backgroundColor: '#E7F0FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adminDangerSmallButton: {
    backgroundColor: '#FFE2E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adminSmallButtonText: {
    color: '#2F5D9A',
    fontWeight: '900',
    fontSize: 12,
  },
  adminBusyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  adminBusyText: {
    color: '#3468B3',
    fontWeight: '800',
  },
  loginHint: {
    color: '#5A7397',
    fontSize: 14,
    lineHeight: 20,
  },
  demoCard: {
    backgroundColor: '#F2F7FF',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  demoTitle: {
    color: '#2E5B97',
    fontSize: 15,
    fontWeight: '800',
  },
  demoText: {
    color: '#5C7396',
    fontSize: 14,
    fontWeight: '600',
  },
  loginError: {
    color: '#C74949',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  authLinkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  authLinkText: {
    color: '#356BB8',
    fontSize: 15,
    fontWeight: '800',
  },
  loginBadgeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  loginBadge: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  loginBadgeNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2F5D9A',
    marginBottom: 6,
  },
  loginBadgeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#637996',
  },
  headerChip: {
    backgroundColor: '#E7F0FF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerChipText: {
    color: '#3468B3',
    fontWeight: '800',
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(246, 242, 237, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrollArea: {
    flex: 1,
  },
  tasksList: {
    gap: 16,
    paddingBottom: 100,
  },
  taskCard: {
    borderRadius: 18,
    padding: 16,
  },
  taskSubject: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: 10,
  },
  separatorDark: {
    height: 1,
    backgroundColor: '#D8D8D8',
    marginVertical: 12,
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskMeta: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priorityText: {
    color: '#375375',
    fontWeight: '700',
  },
  completeButton: {
    backgroundColor: '#F7F4EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  completeButtonText: {
    color: '#486B97',
    fontWeight: '700',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2F7EEA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 12,
    elevation: 7,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 36,
  },
  formContainer: {
    gap: 20,
    paddingBottom: 20,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#415A7E',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7D7D7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#25364D',
  },
  selector: {
    gap: 10,
  },
  selectorOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7D7D7',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorOptionActive: {
    backgroundColor: '#E7F0FF',
    borderColor: '#3C7BEA',
  },
  selectorText: {
    color: '#415A7E',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorTextActive: {
    color: '#295AA8',
    fontWeight: '800',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  priorityHigh: {
    backgroundColor: '#FFE7DE',
    borderColor: '#F27A4A',
  },
  priorityMedium: {
    backgroundColor: '#F7F1E1',
    borderColor: '#D6B45C',
  },
  priorityLow: {
    backgroundColor: '#EAF5E8',
    borderColor: '#87C26E',
  },
  priorityOptionActive: {
    transform: [{ scale: 1.02 }],
  },
  priorityOptionText: {
    color: '#415A7E',
    fontWeight: '700',
  },
  priorityOptionTextActive: {
    color: '#24344A',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#3C7BEA',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 4,
  },
  detailBanner: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  detailBannerText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  detailTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#2A3D58',
    marginBottom: 16,
  },
  detailMeta: {
    fontSize: 18,
    color: '#4A5E7C',
    fontWeight: '600',
    marginBottom: 10,
  },
  detailPriorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailPriorityBadge: {
    backgroundColor: '#F27A4A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailPriorityText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  detailDescription: {
    color: '#5C6C83',
    fontSize: 16,
    lineHeight: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#3C6FB0',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: '#E75E57',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
  },
  summaryLine: {
    color: '#4B5D76',
    fontSize: 22,
    fontWeight: '700',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
  },
  progressTitle: {
    color: '#2F4668',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
  },
  progressBarTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: '#DCE5F2',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#3C7BEA',
  },
  progressValue: {
    marginTop: 10,
    textAlign: 'right',
    color: '#48668E',
    fontWeight: '800',
    fontSize: 18,
  },
  encouragement: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    color: '#2D4A70',
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: '#E75E57',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
});
