
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; 
        userId: string; 
        email?: string; 
        name?: string; 
      };
    }
  }
}


export {};

