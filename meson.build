project(
  'pipoca',
  license: 'BlueOak-1.0.0',
  license_files: 'LICENSE.md',
  meson_version: '>=1.1',
  version: '1.0.0',
)

fs = import('fs')
gnome = import('gnome')
i18n = import('i18n')

app_id = 'io.github.tduarte.Pipoca'
gettext_package = meson.project_name()
version = meson.project_version()
vcs_tag = 'unknown'

git = find_program('git', required: false)
if git.found() and fs.is_dir('.git')
  result = run_command(git, 'rev-parse', '--short', 'HEAD', check: false)
  if result.returncode() == 0
    vcs_tag = result.stdout().strip()
  endif
endif

prefix = get_option('prefix')
bindir = prefix / get_option('bindir')
datadir = prefix / get_option('datadir')
localedir = prefix / get_option('localedir')
pkgdatadir = datadir / app_id

dependency('gio-2.0', version: '>=2.84')
dependency('glib-2.0', version: '>=2.84')
dependency('gobject-2.0', version: '>=2.84')
dependency('gtk4', version: '>=4.18')
dependency('libadwaita-1', version: '>=1.7')

configure_file(
  configuration: {
    'app_id': app_id,
    'datadir': datadir,
    'gettext_package': gettext_package,
    'localedir': localedir,
    'pkgdatadir': pkgdatadir,
    'version': f'@version@+@vcs_tag@',
  },
  input: 'bin/pipoca.in',
  install: true,
  install_dir: bindir,
  install_mode: 'rwxr--r--',
  output: 'pipoca',
)

## Build JS bundle in-sandbox using Node SDK (offline)
# Require node/npm from the Flatpak SDK extension
node = find_program('node', required: true)
npm = find_program('npm', required: true)

# Use the same cache path where the manifest vendors npm artifacts
cachedir = get_option('cachedir')
if cachedir == ''
  cachedir = meson.project_source_root() / 'flatpak-node/npm-cache'
endif

npm_ci = custom_target(
  'npm-ci',
  command: [
    npm, 'ci',
    '--cache', cachedir,
    '--no-audit',
    '--fund=false',
    '--loglevel=verbose',
    '--prefer-offline',
    '--offline',
    '--omit=dev', # install only production deps (esbuild is in dependencies)
  ],
  depend_files: files('package-lock.json', '.npmrc'),
  output: 'npm-ci',
  build_by_default: true,
)

custom_target(
  'node-esbuild',
  build_always_stale: true,
  command: [
    node,
    '@INPUT0@',
    meson.current_build_dir() / '@INPUT1@',
    meson.current_build_dir() / '@OUTPUT@',
  ],
  console: true,
  depends: npm_ci,
  input: ['scripts/esbuild.js', 'src/app.ts'],
  install_dir: datadir,
  install: true,
  output: app_id,
)

subdir('data')
subdir('po')
gnome.post_install(
  glib_compile_schemas: true,
  gtk_update_icon_cache: true,
  update_desktop_database: true,
)
