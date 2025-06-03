configure_file(
  configuration: {'name': app_id, 'exec': bindir / meson.project_name()},
  input: f'@app_id@.service.in',
  install: true,
  install_dir: datadir / 'dbus-1/services',
  output: f'@app_id@.service',
)

desktop_file = configure_file(
  configuration: {
    'exec': meson.project_name(),
    'icon': app_id,
    'try_exec': meson.project_name(),
  },
  input: f'@app_id@.desktop.in',
  install: true,
  install_dir: datadir / 'applications',
  output: f'@app_id@.desktop',
)

desktop_file_validate = find_program('desktop-file-validate', required: false)
if desktop_file_validate.found()
  test('desktop-file-validation', desktop_file_validate, args: [desktop_file])
endif

gnome.compile_resources(
  app_id,
  configure_file(
    configuration: {'prefix': '/' + app_id.replace('.', '/')},
    input: f'@app_id@.gresource.xml.in',
    output: f'@app_id@.gresource.xml',
  ),
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

configure_file(
  configuration: {
    'gettext_domain': gettext_package,
    'id': app_id,
    'path': '/' + app_id.replace('.', '/') + '/',
  },
  input: f'@app_id@.gschema.xml.in',
  install: true,
  install_dir: datadir / 'glib-2.0/schemas',
  output: f'@app_id@.gschema.xml',
)

glib_compile_schemas = find_program('glib-compile-schemas', required: false)
if glib_compile_schemas.found()
  test(
    'gschemas-file-validation',
    glib_compile_schemas,
    args: ['--strict', '--dry-run', meson.current_build_dir()],
  )
endif

install_data(
  f'icons/@app_id@.svg',
  install_dir: datadir / 'icons/hicolor/scalable/apps',
)

install_data(
  f'icons/@app_id@-symbolic.svg',
  install_dir: datadir / 'icons/hicolor/symbolic/apps',
)

metadata_file = i18n.merge_file(
  input: configure_file(
    configuration: {
      'id': app_id,
      'launchable': f'@app_id@.desktop',
      'translation_id': gettext_package,
    },
    input: f'@app_id@.metainfo.xml.in.in',
    output: f'@app_id@.metainfo.xml.in',
  ),
  install: true,
  install_dir: datadir / 'metainfo',
  output: f'@app_id@.metainfo.xml',
  po_dir: meson.project_source_root() / 'po',
)

appstreamcli = find_program('appstreamcli', required: false)
if appstreamcli.found()
  test(
    'metadata-file-validation',
    appstreamcli,
    args: ['validate', '--no-net', '--explain', metadata_file.full_path()],
  )
endif
