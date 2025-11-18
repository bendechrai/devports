#!/bin/zsh
#compdef devports

_devports() {
  local curcontext="$curcontext" state line
  typeset -A opt_args

  local cmd=$words[2]
  local subcmd=$words[3]

  # Handle first argument (command)
  if [[ $CURRENT -eq 2 ]]; then
    compadd allocate release list status check reserve unreserve info render gitignore setup worktree completion
    return 0
  fi

  # Handle arguments for specific commands
  case $cmd in
        allocate)
          _arguments \
            '1:project name:($(devports allocate --completion projects 2>/dev/null))' \
            '2:service name:' \
            '(-t --type)'{-t,--type}'[Service type]:type:($(devports allocate --completion types 2>/dev/null | tr '\''\n'\'' '\'' '\''))' \
            '(-q --quiet)'{-q,--quiet}'[Only output the port number]' \
            '--json[Output result as JSON]'
          ;;
        release)
          # Skip completion if --port flag is used
          if [[ ${words[*]} =~ "--port" ]] || [[ ${words[*]} =~ " -p " ]]; then
            _arguments \
              '(-a --all)'{-a,--all}'[Release all ports for the project]' \
              '(-p --port)'{-p,--port}'[Release port by number]' \
              '(-q --quiet)'{-q,--quiet}'[Only output the result]' \
              '--json[Output result as JSON]'
            return 0
          fi

          if [[ $CURRENT -eq 3 ]]; then
            # First argument: project name
            local projects=($(devports release --completion projects 2>/dev/null))
            compadd -a projects
            return 0
          elif [[ $CURRENT -eq 4 ]]; then
            # Second argument: service name for the specific project
            local project=$words[3]
            local services=($(devports release --completion services --project "$project" 2>/dev/null))
            compadd -a services
            return 0
          fi
          _arguments \
            '(-a --all)'{-a,--all}'[Release all ports for the project]' \
            '(-p --port)'{-p,--port}'[Release port by number]' \
            '(-q --quiet)'{-q,--quiet}'[Only output the result]' \
            '--json[Output result as JSON]'
          ;;
        list)
          _arguments \
            '(-p --project)'{-p,--project}'[Filter by project]:project:($(devports list --completion projects 2>/dev/null | tr '\''\n'\'' '\'' '\''))' \
            '(-t --type)'{-t,--type}'[Filter by service type]:type:($(devports list --completion types 2>/dev/null | tr '\''\n'\'' '\'' '\''))' \
            '(-q --quiet)'{-q,--quiet}'[Only output port numbers]' \
            '--json[Output result as JSON]'
          ;;
        status)
          _arguments \
            '--json[Output result as JSON]'
          ;;
        check)
          _arguments \
            '1:port number: ' \
            '(-q --quiet)'{-q,--quiet}'[Only output the result]' \
            '--json[Output result as JSON]'
          ;;
        reserve)
          _arguments \
            '1:port number: ' \
            '2:reason: ' \
            '(-q --quiet)'{-q,--quiet}'[Only output the result]' \
            '--json[Output result as JSON]'
          ;;
        unreserve)
          _arguments \
            '1:port number: ' \
            '(-q --quiet)'{-q,--quiet}'[Only output the result]' \
            '--json[Output result as JSON]'
          ;;
        info)
          if [[ $CURRENT -eq 3 ]]; then
            # Complete project names
            local projects=($(devports list --completion projects 2>/dev/null))
            compadd -a projects
          elif [[ $CURRENT -eq 4 ]]; then
            # Complete service names for the project
            local project=$words[3]
            local services=($(devports list --project "$project" --completion services 2>/dev/null))
            compadd -a services
          fi
          _arguments \
            '--json[Output result as JSON]'
          ;;
        render)
          # Complete .devports files
          _arguments \
            '1:template file:_files -g "*.devports"' \
            '(-p --project)'{-p,--project}'[Project name]: ' \
            '(-o --output)'{-o,--output}'[Output file]:file:_files' \
            '--json[Output result as JSON]'
          ;;
        gitignore)
          _arguments \
            '(-c --clean)'{-c,--clean}'[Remove devports entries from .gitignore]' \
            '(-p --preview)'{-p,--preview}'[Preview changes without modifying files]' \
            '--json[Output result as JSON]'
          ;;
        setup)
          _arguments \
            '(-t --template)'{-t,--template}'[Template file]:template:_files -g "*.devports"' \
            '(-s --services)'{-s,--services}'[Services to set up (comma-separated)]: ' \
            '(-f --force)'{-f,--force}'[Overwrite existing files]' \
            '--skip-render[Skip auto-rendering *.devports files]' \
            '(-h --post-hook)'{-h,--post-hook}'[Script to run after setup]:script:_files' \
            '--json[Output result as JSON]'
          ;;
        worktree)
          if [[ $CURRENT -eq 3 ]]; then
            _values 'worktree command' \
              'add:Create a git worktree' \
              'remove:Remove a git worktree'
          else
            case $subcmd in
              add)
                _arguments \
                  '1:worktree path:_directories' \
                  '(-b --branch)'{-b,--branch}'[Branch name]: ' \
                  '(-s --services)'{-s,--services}'[Services to set up (comma-separated)]: ' \
                  '(-e --env-file)'{-e,--env-file}'[Custom .env file name]: ' \
                  '(-t --template)'{-t,--template}'[Template file]:template:_files -g "*.devports"' \
                  '(-h --post-hook)'{-h,--post-hook}'[Script to run after setup]:script:_files' \
                  '--no-env[Skip .env file creation]' \
                  '--json[Output result as JSON]'
                ;;
              remove)
                _arguments \
                  '1:worktree path:_directories' \
                  '(-f --force)'{-f,--force}'[Force removal even if directory has changes]' \
                  '--json[Output result as JSON]'
                ;;
            esac
          fi
          ;;
        completion)
          if [[ $CURRENT -eq 3 ]]; then
            compadd bash zsh
          else
            _arguments \
              '(-i --install)'{-i,--install}'[Install completion to shell configuration]' \
              '(-u --uninstall)'{-u,--uninstall}'[Remove completion from shell configuration]' \
              '(-c --check)'{-c,--check}'[Check if completion is installed]' \
              '--json[Output result as JSON]'
          fi
          ;;
  esac
}

compdef _devports devports