import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "./auth/auth.decorators";

@ApiTags("Health")
@Controller()
export class AppController {
  @Public()
  @ApiOperation({ summary: "Check the API is running" })
  @ApiResponse({
    status: 200,
    content: {
      "text/html": {
        schema: { type: "string", example: "Fantasy API is running" },
      },
    },
  })
  @Get()
  getRoot() {
    return "Fantasy API is running";
  }
}
