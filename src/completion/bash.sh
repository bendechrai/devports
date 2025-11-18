#!/bin/bash
# devports completion for bash

_devports_completion() {
    local cur prev words cword
    _init_completion || return

    case $cword in
        1)
            COMPREPLY=( $(compgen -W "allocate release list status check reserve unreserve info render gitignore setup worktree completion" -- "$cur") )
            ;;
        2)
            case $prev in
                allocate)
                    if [[ "$cur" != -* ]]; then
                        # Complete with project names
                        local projects=$(devports allocate --completion projects 2>/dev/null | tr '\n' ' ')
                        COMPREPLY=( $(compgen -W "$projects" -- "$cur") )
                    else
                        COMPREPLY=( $(compgen -W "--type --quiet --json" -- "$cur") )
                    fi
                    ;;
                release)
                    # Skip completion if --port flag is used
                    if [[ "${words[*]}" =~ "--port" ]] || [[ "${words[*]}" =~ " -p " ]]; then
                        COMPREPLY=( $(compgen -W "--all --port --quiet --json" -- "$cur") )
                    elif [[ "$cur" != -* ]]; then
                        # Complete with project names
                        local projects=$(devports release --completion projects 2>/dev/null | tr '\n' ' ')
                        COMPREPLY=( $(compgen -W "$projects" -- "$cur") )
                    else
                        COMPREPLY=( $(compgen -W "--all --port --quiet --json" -- "$cur") )
                    fi
                    ;;
                list)
                    COMPREPLY=( $(compgen -W "--project --type --quiet --json" -- "$cur") )
                    ;;
                status)
                    COMPREPLY=( $(compgen -W "--json" -- "$cur") )
                    ;;
                check)
                    COMPREPLY=( $(compgen -W "--quiet --json" -- "$cur") )
                    ;;
                reserve)
                    COMPREPLY=( $(compgen -W "--quiet --json" -- "$cur") )
                    ;;
                unreserve)
                    COMPREPLY=( $(compgen -W "--quiet --json" -- "$cur") )
                    ;;
                info)
                    if [[ "$cur" != -* ]]; then
                        # Complete with project names
                        local projects=$(devports list --completion projects 2>/dev/null | tr '\n' ' ')
                        COMPREPLY=( $(compgen -W "$projects" -- "$cur") )
                    else
                        COMPREPLY=( $(compgen -W "--json" -- "$cur") )
                    fi
                    ;;
                render)
                    COMPREPLY=( $(compgen -W "--project --output --json" -- "$cur") )
                    ;;
                gitignore)
                    COMPREPLY=( $(compgen -W "--clean --preview --json" -- "$cur") )
                    ;;
                setup)
                    COMPREPLY=( $(compgen -W "--template --services --force --skip-render --post-hook --json" -- "$cur") )
                    ;;
                worktree)
                    COMPREPLY=( $(compgen -W "add remove" -- "$cur") )
                    ;;
                completion)
                    COMPREPLY=( $(compgen -W "bash zsh" -- "$cur") )
                    ;;
                *)
                    ;;
            esac
            ;;
        3)
            case ${words[1]} in
                allocate)
                    # Service name - no completion (new service name)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=( $(compgen -W "--type --quiet --json" -- "$cur") )
                    fi
                    ;;
                release)
                    # Skip completion if --port flag is used
                    if [[ "${words[*]}" =~ "--port" ]] || [[ "${words[*]}" =~ " -p " ]]; then
                        return 0
                    elif [[ "$cur" != -* ]] && [[ "${words[2]}" != -* ]]; then
                        # Complete with service names for the project
                        local project=${words[2]}
                        local services=$(devports release --completion services --project "$project" 2>/dev/null | tr '\n' ' ')
                        COMPREPLY=( $(compgen -W "$services" -- "$cur") )
                    else
                        COMPREPLY=( $(compgen -W "--all --port --quiet --json" -- "$cur") )
                    fi
                    ;;
                info)
                    if [[ "$cur" != -* ]] && [[ "${words[2]}" != -* ]]; then
                        # Complete with service names for the project
                        local project=${words[2]}
                        local services=$(devports list --project "$project" --completion services 2>/dev/null | tr '\n' ' ')
                        COMPREPLY=( $(compgen -W "$services" -- "$cur") )
                    else
                        COMPREPLY=( $(compgen -W "--json" -- "$cur") )
                    fi
                    ;;
                worktree)
                    case ${words[2]} in
                        add)
                            COMPREPLY=( $(compgen -W "--branch --services --env-file --template --post-hook --no-env --json" -- "$cur") )
                            ;;
                        remove)
                            COMPREPLY=( $(compgen -W "--force --json" -- "$cur") )
                            ;;
                        *)
                            # Let default directory completion handle paths
                            ;;
                    esac
                    ;;
                completion)
                    COMPREPLY=( $(compgen -W "--install --uninstall --check --json" -- "$cur") )
                    ;;
                *)
                    ;;
            esac
            ;;
        *)
            # Handle flags for all commands
            case $prev in
                --type|-t)
                    local types=$(devports allocate --completion types 2>/dev/null | tr '\n' ' ')
                    COMPREPLY=( $(compgen -W "$types" -- "$cur") )
                    ;;
                --project|-p)
                    local projects=$(devports list --completion projects 2>/dev/null | tr '\n' ' ')
                    COMPREPLY=( $(compgen -W "$projects" -- "$cur") )
                    ;;
                --template)
                    COMPREPLY=( $(compgen -f -X "!*.devports" -- "$cur") )
                    ;;
                --output|-o)
                    COMPREPLY=( $(compgen -f -- "$cur") )
                    ;;
                --env-file|-e)
                    COMPREPLY=( $(compgen -f -- "$cur") )
                    ;;
                --post-hook|-h)
                    COMPREPLY=( $(compgen -f -- "$cur") )
                    ;;
                *)
                    # Default flag completion
                    case ${words[1]} in
                        allocate)
                            COMPREPLY=( $(compgen -W "--type --quiet --json" -- "$cur") )
                            ;;
                        release)
                            COMPREPLY=( $(compgen -W "--all --port --quiet --json" -- "$cur") )
                            ;;
                        list)
                            COMPREPLY=( $(compgen -W "--project --type --quiet --json" -- "$cur") )
                            ;;
                        status)
                            COMPREPLY=( $(compgen -W "--json" -- "$cur") )
                            ;;
                        check)
                            COMPREPLY=( $(compgen -W "--quiet --json" -- "$cur") )
                            ;;
                        reserve)
                            COMPREPLY=( $(compgen -W "--quiet --json" -- "$cur") )
                            ;;
                        unreserve)
                            COMPREPLY=( $(compgen -W "--quiet --json" -- "$cur") )
                            ;;
                        info)
                            COMPREPLY=( $(compgen -W "--json" -- "$cur") )
                            ;;
                        render)
                            COMPREPLY=( $(compgen -W "--project --output --json" -- "$cur") )
                            ;;
                        gitignore)
                            COMPREPLY=( $(compgen -W "--clean --preview --json" -- "$cur") )
                            ;;
                        setup)
                            COMPREPLY=( $(compgen -W "--template --services --force --skip-render --post-hook --json" -- "$cur") )
                            ;;
                        worktree)
                            case ${words[2]} in
                                add)
                                    COMPREPLY=( $(compgen -W "--branch --services --env-file --template --post-hook --no-env --json" -- "$cur") )
                                    ;;
                                remove)
                                    COMPREPLY=( $(compgen -W "--force --json" -- "$cur") )
                                    ;;
                            esac
                            ;;
                        completion)
                            COMPREPLY=( $(compgen -W "--install --uninstall --check --json" -- "$cur") )
                            ;;
                    esac
                    ;;
            esac
            ;;
    esac
}

complete -F _devports_completion devports