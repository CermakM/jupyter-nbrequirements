/**
 * CLI.
 *
 * Command wrapper which acts as sort of a command line interface.
 *
 * @link   https://github.com/CermakM/jupyter-nbrequirements#readme
 * @file   This module implements a command wrapper.
 * @author Marek Cermak <macermak@redhat.com>
 * @since  0.0.1
 */

import _ from "lodash"

import { Logger } from "../config"
import { notify } from "../utils"

import Command, { DefaultArguments } from "./command"
import { Context } from "../types"
import { OutputError } from "../types/nb"

import store from "../ui/store"

import {
    Clear,
    Ensure,
    Add,
    Get,
    Set,
    Lock,
    Install,
    Kernel,
    Help,
} from "./requirements"

declare const DEFAULT_NOTIFICATION_TIMEOUT: number

/**
 * Execute given command in the current runtime context.
 *
 * @export
 * @param {string} command
 * @param {DefaultArguments} args
 * @param {HTMLDivElement} [element]
 * @param {Context} [context]
 * @returns
 */
export async function cli( command: string, args: DefaultArguments, element?: HTMLDivElement, context?: Context ) {
    let cmd: Command
    switch ( command ) {

        /**
         * Clear notebook requirements and locked requirements metadata.
         *
         * @param {Clear.Arguments} args
         * @memberof Clear
         */
        case "clear": cmd = new Clear(); break

        /**
         * Ensure gets a project into a complete, reproducible, and likely compilable state.
         *
         * @param {Get.Arguments} args
         * @param {HTMLDivElement} element
         * @returns {Promise<void>}
         * @memberof Ensure
         */
        case "ensure": cmd = new Ensure(); break

        /**
         * Add dependency to the notebook metadata without installing it.
         *
         * @param {Add.Arguments} args
         * @returns {Promise<void>}
         * @memberof Get
         */
        case "add": cmd = new Add(); break

        /**
         * Get notebook requirements from the notebook metadata.
         * If the metadata are not set, gather library usage from the notebook.
         *
         * @param {Get.Arguments} args
         * @param {HTMLDivElement} element
         * @returns {Promise<void>}
         * @memberof Get
         */
        case "get": cmd = new Get(); break

        /**
         * Remove a notebook dependency
         *
         * @param {Remove.Arguments} args
         * @returns {Promise<void>}
         * @memberof Remove
         */
        case "remove": cmd = new Get(); break

        /**
         * Set notebook requirements.
         * If `to_file` argument is provided, writes them to the Pipfile.
         *
         * @param {Set.Arguments} args
         * @memberof Set
         */
        case "set": cmd = new Set(); break

        /**
         * Lock notebook requirements.
         * If `to_file` argument is provided, writes them to the Pipfile.lock.
         *
         * @param {Lock.Arguments} args
         * @param {HTMLDivElement} element
         * @returns {Promise<void>}
         * @memberof Lock
         */
        case "lock": cmd = new Lock(); break

        /**
         * Install notebook requirements to a virtual environment.
         * If no such virtual environment exists, create it first.
         *
         * @param {Install.Arguments} args
         * @returns {Promise<void>}
         * @memberof Install
         */
        case "install": cmd = new Install(); break

        /**
         * Create and/or set a new Jupyter kernel.
         *
         * @param {Kernel.Arguments} args
         * @param {HTMLDivElement} element
         * @returns {Promise<void>}
         * @memberof Kernel
         */
        case "kernel": cmd = new Kernel(); break

        /** Display help and exit */
        default: cmd = new Help( command )
    }

    let should_notify = false
    let status: "Success" | "Failed" = "Failed"

    // make sure the cell is marked as running
    if ( !_.isUndefined( context ) ) {
        // @ts-ignore
        context.cell.running = true
    }

    try {

        setTimeout( () => { should_notify = true }, DEFAULT_NOTIFICATION_TIMEOUT )
        // Run the command
        await cmd.run( args, element, context )
            .then( () => {

                // make sure the cell is marked correctly as finished
                if ( !_.isUndefined( context ) ) {
                    // @ts-ignore
                    context.cell.running = false
                }

                status = "Success"
            } )
            .catch( ( err: Error ) => {
                throw err
            } )

    } catch ( err ) {
        status = "Failed"

        Logger.error( err )

        if ( context && !_.isUndefined( context.cell ) ) {
            const exc = typeof err === "string" ? new Error( err ) : err
            const msg = exc.message.replace( /Error: /, "" )

            const obj: OutputError = {
                output_type: "error",
                ename: exc.name,
                evalue: msg,
                traceback: exc.stack.split( "\n" )
            }

            // append the error output
            context.cell.output_area.append_error( obj )
        }
    }
    finally {
        store.dispatch( "sync" )
    }

    if ( should_notify && !document.hasFocus() ) {
        notify( `Execution finished: ${ status }`, { renotify: true, tag: command } )
    }
}
