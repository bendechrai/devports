/**
 * Response formatter service - centralizes JSON/console output patterns
 * Consolidates the repeated logic across all commands for DRY compliance
 */

export interface ResponseOptions {
  json?: boolean;
  quiet?: boolean;
}

export interface ResponseData {
  success: boolean;
  message?: string;
  data?: unknown;
}

export class ResponseFormatter {
  /**
   * Format and output a response based on options
   * Handles both JSON and console output patterns
   */
  static format(
    response: ResponseData,
    options: ResponseOptions = {}
  ): ResponseData {
    if (options.json) {
      // JSON output - consistent across all commands
      const jsonData = response.data ?? {
        success: response.success,
        message: response.message,
      };
      console.log(JSON.stringify(jsonData, null, 2));
      return response;
    }

    if (options.quiet) {
      // Quiet mode - minimal or no output
      return response;
    }

    // Console output - show message if present
    if (response.message) {
      console.log(response.message);
    }

    return response;
  }

  /**
   * Format success response with message
   */
  static success(message: string, data?: unknown): ResponseData {
    return {
      success: true,
      message,
      data,
    };
  }

  /**
   * Format error response with message
   */
  static error(message: string, data?: unknown): ResponseData {
    return {
      success: false,
      message,
      data,
    };
  }

  /**
   * Format data-only response (for list operations, etc.)
   */
  static data(data: unknown, message?: string): ResponseData {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * Handle quiet-specific output (like port numbers only)
   */
  static quiet(value: string | number, data?: unknown): ResponseData {
    console.log(value);
    return {
      success: true,
      data,
    };
  }

  /**
   * Format port allocation response (common pattern)
   */
  static portAllocation(
    port: number,
    project: string,
    service: string,
    type?: string
  ): ResponseData {
    const message = `✅ Allocated port ${port} for ${project}/${service}`;
    const data = {
      port,
      project,
      service,
      type,
      allocatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      message,
      data,
    };
  }

  /**
   * Format port release response (common pattern)
   */
  static portRelease(count: number, target?: string): ResponseData {
    const message =
      count > 0
        ? `✅ Released ${count} port(s)${target ? ` for ${target}` : ''}`
        : `⚠️  No ports found${target ? ` for ${target}` : ''}`;

    return {
      success: count > 0,
      message,
      data: { releasedCount: count },
    };
  }
}
